import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteUserData } from '@/lib/compliance/deleteUser'
import { getCancelScheduledDeletionReason } from '@/lib/compliance/deletionGuards'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: pendingDeletions, error } = await admin
    .from('deletion_schedule')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[cron/process-deletions] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendingDeletions?.length) {
    return NextResponse.json({ processed: 0, message: 'No deletions due' })
  }

  const results: { email: string; success: boolean; error?: string; skipped?: string }[] = []

  for (const scheduled of pendingDeletions) {
    const cancelReason = await getCancelScheduledDeletionReason({
      stripe,
      admin,
      userId: scheduled.user_id,
      stripeCustomerId: scheduled.stripe_customer_id,
    })

    if (cancelReason) {
      await admin
        .from('deletion_schedule')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancelReason,
        })
        .eq('id', scheduled.id)

      console.log(
        `[cron/process-deletions] Cancelled scheduled deletion for ${scheduled.email}: ${cancelReason}`,
      )
      results.push({ email: scheduled.email, success: false, skipped: cancelReason })
      continue
    }

    console.log(`[cron/process-deletions] Processing deletion for ${scheduled.email}`)

    const result = await deleteUserData({
      userId: scheduled.user_id,
      email: scheduled.email,
      reason: scheduled.reason as 'subscription_cancelled',
      initiatedBy: 'system',
      dryRun: false,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    })

    await admin
      .from('deletion_schedule')
      .update({
        status: result.success ? 'executed' : 'pending',
        executed_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', scheduled.id)

    results.push({
      email: scheduled.email,
      success: result.success,
      error: result.error,
    })
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success && !r.skipped).length
  const cancelled = results.filter((r) => r.skipped).length

  console.log(
    `[cron/process-deletions] Complete: ${succeeded} succeeded, ${failed} failed, ${cancelled} cancelled`,
  )

  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed,
    cancelled,
    results,
  })
}

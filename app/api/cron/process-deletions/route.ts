import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteUserData } from '@/lib/compliance/deleteUser'
import { getCancelScheduledDeletionReason } from '@/lib/compliance/deletionGuards'
import { recordCronHealth } from '@/lib/cron/recordCronHealth'
import { requireCronAuth } from '@/lib/api/internalApiAuth'
import {
  nextDeletionRetryAt,
  sendDeletionRetryAlertEmail,
} from '@/lib/email/deletionRetryAlertEmail'
import { createStripeClient } from '@/lib/stripe/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: pendingDeletions, error } = await admin
      .from('deletion_schedule')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (error) {
      console.error('[cron/process-deletions] fetch error:', error.message)
      await recordCronHealth('process-deletions', 'error', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!pendingDeletions?.length) {
      await recordCronHealth('process-deletions', 'ok', 'No deletions due')
      return NextResponse.json({ processed: 0, message: 'No deletions due' })
    }

    const results: {
      email: string
      success: boolean
      error?: string
      skipped?: string
    }[] = []

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

      if (result.success) {
        await admin
          .from('deletion_schedule')
          .update({
            status: 'executed',
            executed_at: new Date().toISOString(),
            retry_count: 0,
            next_retry_at: null,
            last_error: null,
          })
          .eq('id', scheduled.id)
      } else {
        const retryCount = (scheduled.retry_count ?? 0) + 1
        const errorMessage = result.error ?? 'unknown error'
        const nextRetry = nextDeletionRetryAt(retryCount)

        await admin
          .from('deletion_schedule')
          .update({
            status: 'pending',
            executed_at: null,
            retry_count: retryCount,
            next_retry_at: nextRetry,
            last_error: errorMessage,
          })
          .eq('id', scheduled.id)

        if (retryCount >= 3 && process.env.COMPLIANCE_EMAIL) {
          try {
            await sendDeletionRetryAlertEmail({
              to: process.env.COMPLIANCE_EMAIL,
              email: scheduled.email,
              retryCount,
              lastError: errorMessage,
            })
          } catch (emailErr) {
            console.error(
              '[cron/process-deletions] retry alert email failed:',
              emailErr,
            )
          }
        }
      }

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

    const status = failed > 0 ? 'warning' : 'ok'
    await recordCronHealth(
      'process-deletions',
      status,
      `${succeeded} ok, ${failed} failed, ${cancelled} cancelled`,
    )

    return NextResponse.json({
      processed: results.length,
      succeeded,
      failed,
      cancelled,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'process-deletions failed'
    console.error('[cron/process-deletions]', message)
    await recordCronHealth('process-deletions', 'error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { appendAdminUserActionLog, getAdminActorEmail } from '@/lib/admin/adminActionLog'
import { syncConsumerStripeSubscription } from '@/lib/billing/syncConsumerStripeSubscription'
import { createStripeClient } from '@/lib/stripe/config'

type RouteContext = { params: Promise<{ userId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)

  const { userId } = await context.params
  const admin = createAdminClient()

  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer on record for this user' },
        { status: 400 },
      )
    }

    const { before, after } = await syncConsumerStripeSubscription(admin, stripe, userId)

    const adminEmail = await getAdminActorEmail(admin, auth.userId)
    await appendAdminUserActionLog(admin, {
      action: 'stripe_sync',
      userId,
      userEmail: profile.email,
      before,
      after,
      adminEmail,
      adminUserId: auth.userId,
    })

    return NextResponse.json({ data: after })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe sync failed'
    const status =
      message === 'No Stripe customer on record for this user' ||
      message === 'User not found'
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createStripeClient } from '@/lib/stripe/config'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

const ACTIVE_FIRM_STATUSES = new Set(['active', 'trialing', 'canceling', 'past_due'])

async function resolveSubscriptionId(
  stripe: Stripe,
  stripeCustomerId: string | null | undefined,
  stripeSubscriptionId: string | null | undefined,
): Promise<string | null> {
  if (stripeSubscriptionId) return stripeSubscriptionId
  if (!stripeCustomerId) return null
  for (const status of ['active', 'trialing'] as const) {
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status,
      limit: 1,
    })
    const id = subs.data[0]?.id
    if (id) return id
  }
  return null
}

export async function POST() {
  try {
    const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'stripe_subscription_id, stripe_customer_id, subscription_status, subscription_period_end, firm_role',
      )
      .eq('id', user.id)
      .single()

    const { data: ownedFirm } = await supabase
      .from('firms')
      .select('subscription_status, stripe_subscription_id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (
      profile?.firm_role === 'owner' &&
      ownedFirm &&
      ACTIVE_FIRM_STATUSES.has(ownedFirm.subscription_status ?? '')
    ) {
      return NextResponse.json(
        {
          error:
            'Your firm subscription is billed separately. Use Manage firm billing to cancel or change seats.',
        },
        { status: 400 },
      )
    }

    const subscriptionId = await resolveSubscriptionId(
      stripe,
      profile?.stripe_customer_id,
      profile?.stripe_subscription_id,
    )

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    if (profile?.subscription_status === 'canceled') {
      return NextResponse.json({ error: 'Subscription already canceled' }, { status: 400 })
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    const periodEndIso = subscriptionPeriodEndIso(updated)
    const mappedStatus = mapConsumerSubscriptionStatus(updated)

    await supabase
      .from('profiles')
      .update({
        subscription_status: mappedStatus,
        stripe_subscription_id: subscriptionId,
        ...(periodEndIso != null ? { subscription_period_end: periodEndIso } : {}),
      })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      accessThrough: periodEndIso,
    })
  } catch (error) {
    console.error('Cancel subscription error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

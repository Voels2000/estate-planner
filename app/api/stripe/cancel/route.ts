import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

async function resolveSubscriptionId(
  stripeCustomerId: string | null | undefined,
  stripeSubscriptionId: string | null | undefined,
): Promise<string | null> {
  if (stripeSubscriptionId) return stripeSubscriptionId
  if (!stripeCustomerId) return null
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
  })
  return subs.data[0]?.id ?? null
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'stripe_subscription_id, stripe_customer_id, subscription_status, subscription_period_end',
      )
      .eq('id', user.id)
      .single()

    const subscriptionId = await resolveSubscriptionId(
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

    const periodEndIso = new Date(updated.current_period_end * 1000).toISOString()

    await supabase
      .from('profiles')
      .update({
        subscription_status: 'canceling',
        stripe_subscription_id: subscriptionId,
        subscription_period_end: periodEndIso,
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

/** Pause or resume consumer Stripe subscriptions during B2B2C connect/disconnect. */

import { createStripeClient } from '@/lib/stripe/config'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

export async function pauseActiveStripeSubscriptionAtPeriodEnd(
  stripeCustomerId: string,
): Promise<{ cancelAt: string | null; ok: boolean }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return { cancelAt: null, ok: true }
  }

  try {
    const stripe = createStripeClient(stripeKey)
    const { data } = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })

    const activeSub = data[0]
    if (!activeSub) {
      return { cancelAt: null, ok: true }
    }

    const cancelAt = subscriptionPeriodEndIso(activeSub)

    await stripe.subscriptions.update(activeSub.id, {
      cancel_at_period_end: true,
    })

    return { cancelAt, ok: true }
  } catch (err) {
    console.error('pauseActiveStripeSubscriptionAtPeriodEnd:', err)
    return { cancelAt: null, ok: false }
  }
}

export async function resumePausedStripeSubscription(
  stripeCustomerId: string,
): Promise<boolean> {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return false
  }

  try {
    const stripe = createStripeClient(stripeKey)
    const { data } = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })
    const activeSub = data[0]
    if (!activeSub?.cancel_at_period_end) {
      return false
    }

    await stripe.subscriptions.update(activeSub.id, {
      cancel_at_period_end: false,
    })
    return true
  } catch (err) {
    console.error('resumePausedStripeSubscription:', err)
    return false
  }
}

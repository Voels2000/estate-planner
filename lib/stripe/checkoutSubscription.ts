import type Stripe from 'stripe'
import { resolveStripeCustomerId } from '@/lib/stripe/stripeIds'

const PREFERRED_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing'])

/** Basil: session.subscription may be null at checkout.session.completed — list by customer. */
export async function resolveCheckoutSubscription(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<Stripe.Subscription | null> {
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null
  if (subId) {
    return stripe.subscriptions.retrieve(subId)
  }

  if (session.mode !== 'subscription') {
    return null
  }

  const customerId = resolveStripeCustomerId(session.customer)
  if (!customerId) {
    return null
  }

  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  const preferred = data.find((sub) => PREFERRED_STATUSES.has(sub.status))
  return preferred ?? data[0] ?? null
}

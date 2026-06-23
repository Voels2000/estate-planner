// lib/stripe/consumerSubscriptionStatus.ts
//
// Single source of truth for translating a Stripe Subscription into the
// subscription_status we store on profiles. Used by the webhook
// (customer.subscription.updated/deleted), the cancel route, and
// syncConsumerStripeSubscription so the three can never drift.
//
// Correctness rule that fixes the live cancel bug: a subscription scheduled to
// cancel at period end is still Stripe status 'active', but we store 'canceling'.
// We detect that from cancel_at_period_end OR a FUTURE cancel_at — we never
// assume the absence of the flag means "active", because a partial webhook
// payload can omit cancel_at_period_end and the old code then wrote 'active'
// over a real cancel.

import type Stripe from 'stripe'

export type ConsumerSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceling'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'none'

export function mapConsumerSubscriptionStatus(
  subscription: Pick<
    Stripe.Subscription,
    'status' | 'cancel_at_period_end' | 'cancel_at'
  >,
): ConsumerSubscriptionStatus {
  const s = subscription.status

  if (s === 'canceled' || s === 'incomplete_expired') {
    return 'canceled'
  }

  if (s === 'unpaid') {
    return 'unpaid'
  }

  const scheduledToCancel =
    subscription.cancel_at_period_end === true ||
    (typeof subscription.cancel_at === 'number' &&
      Number.isFinite(subscription.cancel_at) &&
      subscription.cancel_at * 1000 > Date.now()) // stripe-dates-ok: cancel_at schedule compare, not ISO conversion

  if ((s === 'active' || s === 'trialing') && scheduledToCancel) {
    return 'canceling'
  }

  switch (s) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'incomplete':
    case 'paused':
      return 'none'
    default:
      return 'none'
  }
}

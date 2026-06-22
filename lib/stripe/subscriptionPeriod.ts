import type Stripe from 'stripe'

type SubscriptionWithItemPeriod = Stripe.Subscription & {
  current_period_end?: number
  items?: { data?: Array<{ current_period_end?: number }> }
}

function firstSubscriptionItem(
  subscription: Stripe.Subscription,
): { current_period_end?: number } | undefined {
  const sub = subscription as SubscriptionWithItemPeriod
  return sub.items?.data?.[0]
}

/** Basil/Clover: period on SubscriptionItem; legacy top-level fallback. */
export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const fromItem = firstSubscriptionItem(subscription)?.current_period_end
  if (typeof fromItem === 'number') return fromItem
  const topLevel = (subscription as SubscriptionWithItemPeriod).current_period_end
  if (typeof topLevel === 'number') return topLevel
  return null
}

/** Never throws — returns null when period end is absent. */
export function subscriptionPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  if (periodEnd == null) return null
  return new Date(periodEnd * 1000).toISOString()
}

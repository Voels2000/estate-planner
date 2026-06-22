// Single date/period boundary between Stripe payloads and our database.
// Basil/Clover moved current_period_* onto SubscriptionItem; read item first,
// fall back to legacy top-level fields. All seconds→ISO conversions use
// unixToIsoOrNull (never throws).

import type Stripe from 'stripe'

type SubscriptionWithItemPeriod = Stripe.Subscription & {
  current_period_start?: number
  current_period_end?: number
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> }
}

function firstSubscriptionItem(
  subscription: Stripe.Subscription,
): { current_period_start?: number; current_period_end?: number } | undefined {
  const sub = subscription as SubscriptionWithItemPeriod
  return sub.items?.data?.[0]
}

function readFinitePeriod(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Convert Stripe Unix seconds to ISO; null for missing/invalid — never throws. */
export function unixToIsoOrNull(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Basil/Clover: period end on SubscriptionItem; legacy top-level fallback. */
export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const fromItem = readFinitePeriod(firstSubscriptionItem(subscription)?.current_period_end)
  if (fromItem != null) return fromItem
  return readFinitePeriod((subscription as SubscriptionWithItemPeriod).current_period_end)
}

/** Basil/Clover: period start on SubscriptionItem; legacy top-level fallback. */
export function getSubscriptionPeriodStart(subscription: Stripe.Subscription): number | null {
  const fromItem = readFinitePeriod(firstSubscriptionItem(subscription)?.current_period_start)
  if (fromItem != null) return fromItem
  return readFinitePeriod((subscription as SubscriptionWithItemPeriod).current_period_start)
}

/** Never throws — returns null when period end is absent. */
export function subscriptionPeriodEndIso(subscription: Stripe.Subscription): string | null {
  return unixToIsoOrNull(getSubscriptionPeriodEnd(subscription))
}

/** Never throws — returns null when period start is absent. */
export function subscriptionPeriodStartIso(subscription: Stripe.Subscription): string | null {
  return unixToIsoOrNull(getSubscriptionPeriodStart(subscription))
}

/** Locale date string for renewal emails; null when timestamp invalid. */
export function formatUnixDateEnUs(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

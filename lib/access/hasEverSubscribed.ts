import type { ConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'

/** Statuses that mark a consumer as having subscribed (no fresh app trial). */
const SUBSCRIBED_STATUSES = new Set<ConsumerSubscriptionStatus>([
  'active',
  'canceling',
  'trialing',
])

export function shouldSetHasEverSubscribed(
  subscriptionStatus: string | null | undefined,
): boolean {
  if (!subscriptionStatus) return false
  return SUBSCRIBED_STATUSES.has(subscriptionStatus as ConsumerSubscriptionStatus)
}

export function withHasEverSubscribed<T extends { subscription_status: string }>(
  fields: T,
): T & { has_ever_subscribed?: true } {
  if (shouldSetHasEverSubscribed(fields.subscription_status)) {
    return { ...fields, has_ever_subscribed: true }
  }
  return fields
}

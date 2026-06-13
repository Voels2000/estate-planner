import { findConsumerPriceByPriceId, type BillingPeriod } from '@/lib/billing/stripePrices'

/** Resolve monthly vs annual from a stored Stripe price id (subscription_plan). */
export function getSubscribedBillingPeriod(
  subscriptionPlanPriceId: string | null | undefined,
): BillingPeriod | null {
  if (!subscriptionPlanPriceId) return null
  return findConsumerPriceByPriceId(subscriptionPlanPriceId)?.period ?? null
}

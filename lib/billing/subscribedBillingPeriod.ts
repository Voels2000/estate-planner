import { STRIPE_PRICES, type BillingPeriod } from '@/lib/billing/stripePrices'

/** Resolve monthly vs annual from a stored Stripe price id (subscription_plan). */
export function getSubscribedBillingPeriod(
  subscriptionPlanPriceId: string | null | undefined,
): BillingPeriod | null {
  if (!subscriptionPlanPriceId) return null
  for (const config of Object.values(STRIPE_PRICES)) {
    if (config.priceId === subscriptionPlanPriceId) {
      return config.period
    }
  }
  return null
}

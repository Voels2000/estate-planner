import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'
import { TIER_PRICES } from '@/lib/tiers'

/** Short upgrade pricing lines for UpgradeBanner and gated modules. */
export function upgradePricingLine(
  requiredTier: 2 | 3,
  annualBillingAvailable = false,
): string {
  if (requiredTier === 3) {
    const monthly = TIER_PRICES[3]
    const trialDays = getConsumerPlanDisplay(3, 'monthly').trialDays
    const trialLabel =
      trialDays > 0 ? `${trialDays}-day free trial, then ` : ''
    if (annualBillingAvailable) {
      const annual = getConsumerPlanDisplay(3, 'annual')
      return `Upgrade to Estate — ${trialLabel}$${monthly}/month or $${annual.annualTotal.toLocaleString()}/year (2 months free).`
    }
    return `Upgrade to Estate — ${trialLabel}$${monthly}/month.`
  }

  const monthly = TIER_PRICES[2]
  if (annualBillingAvailable) {
    const annual = getConsumerPlanDisplay(2, 'annual')
    return `Upgrade to Retirement — $${monthly}/month or $${annual.annualTotal.toLocaleString()}/year (2 months free).`
  }
  return `Upgrade to Retirement — $${monthly}/month.`
}

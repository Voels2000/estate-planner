import { getPriceConfig, hasPriceConfig } from '@/lib/billing/stripePrices'
import { TIER_PRICES } from '@/lib/tiers'

/** Short upgrade pricing lines for UpgradeBanner and gated modules. */
export function upgradePricingLine(requiredTier: 2 | 3): string {
  if (requiredTier === 3) {
    const monthly = TIER_PRICES[3]
    if (hasPriceConfig(3, 'annual')) {
      const annual = getPriceConfig(3, 'annual')
      return `Upgrade to Estate — 14-day free trial, then $${monthly}/month or $${annual.annualTotal.toLocaleString()}/year (2 months free).`
    }
    return `Upgrade to Estate — 14-day free trial, then $${monthly}/month.`
  }

  const monthly = TIER_PRICES[2]
  if (hasPriceConfig(2, 'annual')) {
    const annual = getPriceConfig(2, 'annual')
    return `Upgrade to Retirement — $${monthly}/month or $${annual.annualTotal.toLocaleString()}/year (2 months free).`
  }
  return `Upgrade to Retirement — $${monthly}/month.`
}

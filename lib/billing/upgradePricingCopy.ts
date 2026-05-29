/** Short upgrade pricing lines for UpgradeBanner and gated modules. */
export function upgradePricingLine(requiredTier: 2 | 3): string {
  if (requiredTier === 3) {
    return 'Upgrade to Estate — 14-day free trial, then $149/month or $1,490/year (2 months free).'
  }
  return 'Upgrade to Retirement — $79/month or $790/year (2 months free).'
}

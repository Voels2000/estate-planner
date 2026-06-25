import type { BillingPeriod } from '@/lib/billing/stripePrices'
import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'
import type { BillingMatrixTier } from '@/lib/billing/billingCapabilityMatrix'
import { TIER_NAMES } from '@/lib/tiers'

export type BillingTierColumn = {
  tier: BillingMatrixTier
  name: string
  question: string
  oneLiner: string
  priceMain: string
  priceSub: string | null
  /** Paid tiers only — null for Free. */
  checkoutTier: 1 | 2 | 3 | null
  highlighted: boolean
}

const TIER_QUESTIONS: Record<BillingMatrixTier, string> = {
  0: 'Where do I stand?',
  1: 'Will I be okay?',
  2: 'How confident can I be?',
  3: 'What happens to what I leave?',
}

const TIER_ONE_LINERS: Record<BillingMatrixTier, string> = {
  0: 'Enter your full financial picture, track your net worth, and export your data anytime. Always yours.',
  1: "See where you're headed with a clear forward projection, and compare what-if scenarios and state moves side by side.",
  2: 'Go beyond a single estimate — run thousands of market simulations to see your real odds, and optimize Social Security, Roth, and withdrawals.',
  3: 'Plan what you pass on: estate-tax exposure across states, gifting and titling strategy, trusts, and a secure document vault.',
}

export function getBillingTierColumns(period: BillingPeriod): BillingTierColumn[] {
  const free: BillingTierColumn = {
    tier: 0,
    name: 'Free',
    question: TIER_QUESTIONS[0],
    oneLiner: TIER_ONE_LINERS[0],
    priceMain: '$0',
    priceSub: 'always',
    checkoutTier: null,
    highlighted: false,
  }

  const paid = ([1, 2, 3] as const).map((tier) => {
    const display = getConsumerPlanDisplay(tier, period)
    const annualNote =
      period === 'annual' && display.annualTotal > 0
        ? `billed $${display.annualTotal.toLocaleString()}/yr`
        : '/mo'

    return {
      tier: tier as BillingMatrixTier,
      name: TIER_NAMES[tier],
      question: TIER_QUESTIONS[tier],
      oneLiner: TIER_ONE_LINERS[tier],
      priceMain: `$${display.monthlyEquivalent}`,
      priceSub: period === 'annual' ? annualNote : '/mo',
      checkoutTier: tier,
      highlighted: tier === 3,
    } satisfies BillingTierColumn
  })

  return [free, ...paid]
}

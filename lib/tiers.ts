// lib/tiers.ts
// Single source of truth for consumer tier definitions and feature gating
import { buildPriceIdToTierMap, getPriceConfig } from '@/lib/billing/stripePrices'

export const CONSUMER_PRICE_IDS = {
  get starter() {
    return getPriceConfig(1, 'monthly').priceId
  },
  get retirement() {
    return getPriceConfig(2, 'monthly').priceId
  },
  get estate() {
    return getPriceConfig(3, 'monthly').priceId
  },
}
// Legacy $19 price maps to tier 2
export const LEGACY_PRICE_ID = 'price_1TAlJjCaljka9gJthGTMogQb'
export const TIER_NAMES = {
  1: 'Financial',
  2: 'Retirement',
  3: 'Estate',
} as const
export const TIER_PRICES = {
  1: 29,
  2: 79,
  3: 149,
} as const
export const TIER_DESCRIPTIONS = {
  1: 'Get organized and see your full financial picture',
  2: 'Optimize your retirement with advanced planning tools',
  3: 'Complete estate and advanced tax planning',
} as const
export const TIER_FEATURES = {
  1: [
    'Profile & household setup',
    'Assets & liabilities tracking',
    'Income & expenses',
    'Basic retirement projections',
    'Simple tax estimate',
    'Net worth dashboard',
    'Insurance gap analysis',
    'Data import (CSV/Excel)',
  ],
  2: [
    'Everything in Financial',
    'RMD Calculator',
    'Roth Conversion',
    'Monte Carlo simulations',
    'Lifetime financial snapshot',
  ],
  3: [
    'Everything in Retirement',
    'Federal & state estate tax',
    'Account titling & beneficiaries',
    'Domicile analysis',
    'Incapacity planning',
    'Gifting strategy',
    'Charitable giving',
    'Business succession planning',
  ],
} as const
// Feature gating map — minimum tier required for each feature (0 = free data entry)
export type FeatureTier = 0 | 1 | 2 | 3

export const FEATURE_TIERS: Record<string, FeatureTier> = {
  // Tier 0 — free data entry + net worth / export (matrix + PR 6 export)
  'net-worth-view':      0,
  'data-export':         0,
  profile:               0,
  assets:                0,
  liabilities:           0,
  income:                0,
  expenses:              0,
  businesses:            0,
  'property-casualty':   0,
  insurance:             0,
  // Tier 1 — Financial Planning (modeling)
  dashboard:             1,
  projections:           1,
  scenarios:             1,
  import:                1,
  // Tier 2 — Retirement Planning
  allocation:            2,
  'real-estate':         0,
  'social-security':     2,
  complete:              2,
  rmd:                   2,
  roth:                  2,
  'monte-carlo':         2,
  'digital-assets':      2,
  // Computed analysis on shared pages (see inputComputedBoundary.ts)
  'insurance-gap-analysis': 2,
  'real-estate-analysis':   2,
  'business-succession-analysis': 3,
  // Tier 3 — Estate Planning
  'estate-tax':          3,
  titling:               3,
  'domicile-analysis':   3,
  incapacity:            3,
  'document-vault':      3,
  gifting:               3,
  charitable:            3,
  'business-succession': 3,
  'my-family':           3,
  'my-estate-strategy':  3,
  'my-estate-trust-strategy': 3,
  'trust-will':          3,
}

/** Minimum tier for generated deliverable (estate-plan PDF). Aliased to estate-tax gate. */
export const DELIVERABLE_MIN_TIER = FEATURE_TIERS['estate-tax'] as 1 | 2 | 3
// Stripe Estate trial (subscription_status = 'trialing' from webhook) unlocks tier-3 features.
export const TRIAL_TIER = 3
/** Resolve which consumer tier a profile maps to */
export function resolveConsumerTier(
  subscriptionPlan: string | null,
  consumerTier: number | null,
): number {
  // Already set explicitly
  if (consumerTier && consumerTier >= 1) return consumerTier
  // Legacy $19 plan = tier 2
  if (subscriptionPlan === LEGACY_PRICE_ID) return 2
  // Map price ID to tier
  if (subscriptionPlan === CONSUMER_PRICE_IDS.starter) return 1
  if (subscriptionPlan === CONSUMER_PRICE_IDS.retirement) return 2
  if (subscriptionPlan === CONSUMER_PRICE_IDS.estate) return 3
  // Fall back to PRICE_ID_TO_TIER map (covers annual IDs)
  const mappedTier = PRICE_ID_TO_TIER[subscriptionPlan ?? '']
  if (mappedTier) return mappedTier
  // Default
  return 1
}
/** Check if a user has access to a feature */
export function hasFeatureAccess(
  feature: string,
  userTier: number,
  isAdvisor: boolean,
  isTrial: boolean,
): boolean {
  if (isAdvisor) return true
  const required = FEATURE_TIERS[feature] ?? 1
  if (isTrial) return required <= TRIAL_TIER
  return userTier >= required
}

/** Tier shown on UpgradeBanner (gated modules are tier 1+). */
export function featureUpgradeTier(feature: string): 1 | 2 | 3 {
  const required = FEATURE_TIERS[feature] ?? 1
  if (required >= 3) return 3
  if (required >= 2) return 2
  return 1
}

// Price ID → tier number map — used in webhook and terms page (includes annual prices)
export const PRICE_ID_TO_TIER: Record<string, 1 | 2 | 3> = buildPriceIdToTierMap()

export const ADVISOR_FIRM_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ADVISOR_STARTER_MONTHLY?.trim() ?? '',
  growth: process.env.STRIPE_PRICE_ADVISOR_GROWTH_MONTHLY?.trim() ?? '',
  enterprise: process.env.STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY?.trim() ?? '',
} as const

export const FIRM_PRICE_ID_TO_TIER: Record<string, string> = (
  Object.entries(ADVISOR_FIRM_PRICE_IDS) as [keyof typeof ADVISOR_FIRM_PRICE_IDS, string][]
).reduce<Record<string, string>>((acc, [tier, priceId]) => {
  if (priceId) acc[priceId] = tier
  return acc
}, {})

export const ADVISOR_FIRM_SEAT_RATES: Record<string, number> = {
  starter:    149, // go-live target — see docs/BILLING_B2B2C_POLICY.md (vs RightCapital ~$150, eMoney $250+)
  growth:     99,  // volume band 11–50 seats
  enterprise: 89,  // go-live floor — above Holistiplan, below eMoney enterprise
}

export const ADVISOR_FIRM_SEAT_RANGES: Record<string, { min: number; max: number | null; label: string }> = {
  starter:    { min: 1,  max: 10,  label: '1–10 seats' },
  growth:     { min: 11, max: 50,  label: '11–50 seats' },
  enterprise: { min: 51, max: null, label: '51+ seats' },
}

// Attorney plan price IDs — set in Vercel before go-live:
//   STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY
//   STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY
export const ATTORNEY_PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY ?? 'TODO_ATTORNEY_STARTER',
  growth: process.env.STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY ?? 'TODO_ATTORNEY_GROWTH',
} as const

export type AttorneyPlanKey = keyof typeof ATTORNEY_PLAN_PRICE_IDS

export const ATTORNEY_PLAN_NAMES: Record<AttorneyPlanKey, string> = {
  starter: 'Attorney Starter',
  growth: 'Attorney Growth',
}

export const ATTORNEY_PLAN_LIMITS: Record<AttorneyPlanKey, { clientCap: number; priceMonthly: number }> = {
  starter: { clientCap: 15, priceMonthly: 99 },  // vs Clio Essentials ~$89 — adjunct pricing; see BILLING_B2B2C_POLICY.md
  growth: { clientCap: 50, priceMonthly: 249 },
}

/** Map Stripe price ID → profiles.attorney_tier (1 = Starter, 2 = Growth). */
export function getAttorneyTierFromPriceId(priceId: string): number {
  if (priceId === ATTORNEY_PLAN_PRICE_IDS.starter) return 1
  if (priceId === ATTORNEY_PLAN_PRICE_IDS.growth) return 2
  return 0
}

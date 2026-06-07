// lib/tiers.ts
// Single source of truth for consumer tier definitions and feature gating
import { buildPriceIdToTierMap, getPriceConfig } from '@/lib/billing/stripePrices'

export const CONSUMER_PRICE_IDS = {
  starter: getPriceConfig(1, 'monthly').priceId,
  retirement: getPriceConfig(2, 'monthly').priceId,
  estate: getPriceConfig(3, 'monthly').priceId,
} as const
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
// Feature gating map — minimum tier required for each feature
export const FEATURE_TIERS: Record<string, 1 | 2 | 3> = {
  // Tier 1 — Financial Planning (all paid users)
  dashboard:             1,
  profile:               1,
  assets:                1,
  liabilities:           1,
  income:                1,
  expenses:              1,
  projections:           1,
  allocation:            2,
  'real-estate':         2,
  businesses:            1,
  scenarios:             1,
  'social-security':     2,
  // Tier 2 — Retirement Planning
  complete:              2,
  rmd:                   2,
  roth:                  2,
  'monte-carlo':         2,
  // Friction-reduction sprint (2026-05-27): was 2 — Tier 1 upload+commit intentional for
  // spreadsheet-first onboarding. Import job *history* UI stays Tier 2+ (import/page.tsx).
  import:                1,
  insurance:             1,
  // Tier 3 — Estate Planning
  'estate-tax':          3,
  titling:               3,
  'domicile-analysis':   3,
  incapacity:            3,
  'document-vault':      3,
  gifting:               3,
  charitable:            3,
  'business-succession': 3,
  'digital-assets':      2,
  'property-casualty':   1,
  'my-family':           3,
  'my-estate-strategy':  3,
  'my-estate-trust-strategy': 3,
  'trust-will':          3,
}
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

/** Tier shown on UpgradeBanner (gated modules are always tier 2+). */
export function featureUpgradeTier(feature: string): 2 | 3 {
  const required = FEATURE_TIERS[feature] ?? 1
  return required >= 3 ? 3 : 2
}

// Price ID → tier number map — used in webhook and terms page (includes annual prices)
export const PRICE_ID_TO_TIER: Record<string, 1 | 2 | 3> = buildPriceIdToTierMap()

export const ADVISOR_FIRM_PRICE_IDS = {
  starter:    'price_1TIW5xCaljka9gJtTw9uF5E5',
  growth:     'price_1TIW78Caljka9gJt8vlD9GnF',
  enterprise: 'price_1TIW8gCaljka9gJtTfmEgO2C',
}

export const FIRM_PRICE_ID_TO_TIER: Record<string, string> = {
  'price_1TIW5xCaljka9gJtTw9uF5E5': 'starter',
  'price_1TIW78Caljka9gJt8vlD9GnF': 'growth',
  'price_1TIW8gCaljka9gJtTfmEgO2C': 'enterprise',
}

export const ADVISOR_FIRM_SEAT_RATES: Record<string, number> = {
  starter:    149, // go-live target — see docs/BILLING_B2B2C_POLICY.md (vs RightCapital ~$150, eMoney $250+)
  growth:     99,  // volume band 11–50 seats
  enterprise: 75,  // consider $79 at go-live; enterprise floor vs eMoney enterprise
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

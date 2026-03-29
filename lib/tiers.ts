// lib/tiers.ts
// Single source of truth for consumer tier definitions and feature gating
export const CONSUMER_PRICE_IDS = {
  starter:    'price_1TD2SMCaljka9gJtsbsXsPjC',
  retirement: 'price_1TD2TECaljka9gJtp8fpf3Yk',
  estate:     'price_1TD2WZCaljka9gJt5xUAnv4J',
} as const
// Legacy $19 price maps to tier 2
export const LEGACY_PRICE_ID = 'price_1TAlJjCaljka9gJthGTMogQb'
export const TIER_NAMES = {
  1: 'Financial',
  2: 'Retirement',
  3: 'Estate',
} as const
export const TIER_PRICES = {
  1: 9,
  2: 19,
  3: 34,
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
  ],
  2: [
    'Everything in Financial',
    'RMD Calculator',
    'Roth Conversion',
    'Monte Carlo simulations',
    'Lifetime financial snapshot',
    'Data import (CSV/PDF/DOCX)',
    'Insurance gap analysis',
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
  project:           1,
  allocation:            1,
  'real-estate':         1,
  scenarios:             1,
  'social-security':     1,
  // Tier 2 — Retirement Planning
  complete:              2,
  rmd:                   2,
  roth:                  2,
  'monte-carlo':         2,
  import:                2,
  insurance:             2,
  // Tier 3 — Estate Planning
  'estate-tax':          3,
  titling:               3,
  'domicile-analysis':   3,
  incapacity:            3,
  gifting:               3,
  charitable:            3,
  'business-succession': 3,
}
// Free trial gets tier 2 access
export const TRIAL_TIER = 2
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

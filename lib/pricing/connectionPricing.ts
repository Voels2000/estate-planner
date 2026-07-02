/**
 * Connection-billing v1 — single source of truth for bands, rates, and Stripe price env keys.
 * Stripe volume tiers mirror ADVISOR_BANDS / ATTORNEY_BANDS (Phase 2 setup script).
 */

import type Stripe from 'stripe'

export type ConnectionBand = {
  lo: number
  hi: number
  rate: number
  label: string
}

/** Consumer monthly list prices (USD). Keys match tier 1/2/3 product names in stripePrices.ts. */
export const CONSUMER_TIERS = {
  financial: 19,
  retirement: 49,
  estate: 79,
} as const

export type ConsumerTierKey = keyof typeof CONSUMER_TIERS

/** Annual totals — 10× monthly (~2 months free); same rhythm as prior $290 / $790 / $1490. */
export const CONSUMER_ANNUAL_TOTALS: Record<ConsumerTierKey, number> = {
  financial: CONSUMER_TIERS.financial * 10,
  retirement: CONSUMER_TIERS.retirement * 10,
  estate: CONSUMER_TIERS.estate * 10,
}

export const CONSUMER_PLAN_TIER_TO_KEY: Record<1 | 2 | 3, ConsumerTierKey> = {
  1: 'financial',
  2: 'retirement',
  3: 'estate',
}

export function consumerMonthlyPriceForPlanTier(tier: 1 | 2 | 3): number {
  return CONSUMER_TIERS[CONSUMER_PLAN_TIER_TO_KEY[tier]]
}

export function consumerAnnualTotalForPlanTier(tier: 1 | 2 | 3): number {
  return CONSUMER_ANNUAL_TOTALS[CONSUMER_PLAN_TIER_TO_KEY[tier]]
}

export function consumerAnnualMonthlyEquivalentForPlanTier(tier: 1 | 2 | 3): number {
  return Math.round(consumerAnnualTotalForPlanTier(tier) / 12)
}

export const ADVISOR_BANDS: ConnectionBand[] = [
  { lo: 1, hi: 10, rate: 120, label: 'Starter' },
  { lo: 11, hi: 50, rate: 102, label: 'Growth' },
  { lo: 51, hi: 150, rate: 84, label: 'Practice' },
  { lo: 151, hi: Number.POSITIVE_INFINITY, rate: 72, label: 'Enterprise' },
]

export const ATTORNEY_BANDS: ConnectionBand[] = [
  { lo: 1, hi: 10, rate: 75, label: 'Starter' },
  { lo: 11, hi: 50, rate: 64, label: 'Growth' },
  { lo: 51, hi: 150, rate: 52, label: 'Practice' },
  { lo: 151, hi: Number.POSITIVE_INFINITY, rate: 45, label: 'Enterprise' },
]

export const ADVISOR_FLOOR = 72
export const ATTORNEY_FLOOR = 45

/**
 * Stripe product tax codes — verify against https://docs.stripe.com/tax/tax-codes before prod.
 * US personal vs business SaaS distinction affects WA and other state taxability.
 */
export const STRIPE_TAX_CODE_SAAS_PERSONAL = 'txcd_10103000' // SaaS — personal use (consumer tiers)
export const STRIPE_TAX_CODE_SAAS_BUSINESS = 'txcd_10103001' // SaaS — business use (advisor / attorney)

export const CONNECTION_PRICE_LOOKUP_KEYS = {
  advisor: 'advisor_connection_monthly_v1',
  attorney: 'attorney_connection_monthly_v1',
} as const

export const CONNECTION_STRIPE_PRICE_ENV = {
  advisor: 'STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY',
  attorney: 'STRIPE_PRICE_ATTORNEY_CONNECTION_MONTHLY',
} as const

/** Legacy per-seat / flat-tier prices retired by connection billing (archive with --archive-old). */
export const LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS = [
  'STRIPE_PRICE_ADVISOR_STARTER_MONTHLY',
  'STRIPE_PRICE_ADVISOR_GROWTH_MONTHLY',
  'STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY',
  'STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY',
] as const

export const CONSUMER_V1_LOOKUP_KEYS: Record<ConsumerTierKey, string> = {
  financial: 'financial_monthly_v1',
  retirement: 'retirement_monthly_v1',
  estate: 'estate_monthly_v1',
}

export const CONSUMER_V1_STRIPE_PRICE_ENV: Record<ConsumerTierKey, string> = {
  financial: 'STRIPE_PRICE_FINANCIAL_MONTHLY',
  retirement: 'STRIPE_PRICE_RETIREMENT_MONTHLY',
  estate: 'STRIPE_PRICE_ESTATE_MONTHLY',
}

export const CONSUMER_V1_DISPLAY_NAMES: Record<ConsumerTierKey, string> = {
  financial: 'Financial Essentials',
  retirement: 'Retirement Plus',
  estate: 'Estate Complete',
}

export function bandForCount(count: number, bands: ConnectionBand[]): ConnectionBand {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return bands[0]
  for (const band of bands) {
    if (n >= band.lo && n <= band.hi) return band
  }
  return bands[bands.length - 1]
}

export function rateForCount(count: number, bands: ConnectionBand[], floor: number): number {
  return Math.max(floor, bandForCount(count, bands).rate)
}

/** Resolve connection price IDs from env (empty until Phase 2 --commit + Vercel paste). */
export function resolveConnectionStripePriceIds(): { advisor: string; attorney: string } {
  return {
    advisor: process.env[CONNECTION_STRIPE_PRICE_ENV.advisor]?.trim() ?? '',
    attorney: process.env[CONNECTION_STRIPE_PRICE_ENV.attorney]?.trim() ?? '',
  }
}

/** Volume-tier shape for Stripe Price.create — up_to breakpoints match band hi. */
export function bandsToStripeVolumeTiers(bands: ConnectionBand[]): Stripe.PriceCreateParams.Tier[] {
  return bands.map((band) => ({
    up_to: Number.isFinite(band.hi) ? band.hi : ('inf' as const),
    unit_amount: band.rate * 100,
  }))
}

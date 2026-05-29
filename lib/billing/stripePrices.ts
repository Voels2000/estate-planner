// Single source of truth for Stripe price IDs (from env) and display metadata.

export type BillingPeriod = 'monthly' | 'annual'
export type PlanTier = 1 | 2 | 3

export interface PriceConfig {
  priceId: string
  tier: PlanTier
  period: BillingPeriod
  monthlyEquivalent: number
  annualTotal: number
  trialDays: number
}

/** Legacy monthly price IDs — used when env vars are unset (local dev). */
const LEGACY_MONTHLY_PRICE_IDS = {
  financial: 'price_1TILBRCaljka9gJt6dr44Znq',
  retirement: 'price_1TILEXCaljka9gJtrHqnG3bl',
  estate: 'price_1TILGOCaljka9gJtCDLiKFHp',
} as const

function envPrice(key: string, legacyFallback: string): string {
  return process.env[key]?.trim() || legacyFallback
}

export const STRIPE_PRICES: Record<string, PriceConfig> = {
  financial_monthly: {
    priceId: envPrice('STRIPE_PRICE_FINANCIAL_MONTHLY', LEGACY_MONTHLY_PRICE_IDS.financial),
    tier: 1,
    period: 'monthly',
    monthlyEquivalent: 29,
    annualTotal: 0,
    trialDays: 0,
  },
  financial_annual: {
    priceId: envPrice('STRIPE_PRICE_FINANCIAL_ANNUAL', ''),
    tier: 1,
    period: 'annual',
    monthlyEquivalent: 24,
    annualTotal: 290,
    trialDays: 0,
  },
  retirement_monthly: {
    priceId: envPrice('STRIPE_PRICE_RETIREMENT_MONTHLY', LEGACY_MONTHLY_PRICE_IDS.retirement),
    tier: 2,
    period: 'monthly',
    monthlyEquivalent: 79,
    annualTotal: 0,
    trialDays: 0,
  },
  retirement_annual: {
    priceId: envPrice('STRIPE_PRICE_RETIREMENT_ANNUAL', ''),
    tier: 2,
    period: 'annual',
    monthlyEquivalent: 66,
    annualTotal: 790,
    trialDays: 0,
  },
  estate_monthly: {
    priceId: envPrice('STRIPE_PRICE_ESTATE_MONTHLY', LEGACY_MONTHLY_PRICE_IDS.estate),
    tier: 3,
    period: 'monthly',
    monthlyEquivalent: 149,
    annualTotal: 0,
    trialDays: 14,
  },
  estate_annual: {
    priceId: envPrice('STRIPE_PRICE_ESTATE_ANNUAL', ''),
    tier: 3,
    period: 'annual',
    monthlyEquivalent: 124,
    annualTotal: 1490,
    trialDays: 14,
  },
}

const TIER_PERIOD_KEYS: Record<PlanTier, Record<BillingPeriod, string>> = {
  1: { monthly: 'financial_monthly', annual: 'financial_annual' },
  2: { monthly: 'retirement_monthly', annual: 'retirement_annual' },
  3: { monthly: 'estate_monthly', annual: 'estate_annual' },
}

export function getPriceConfig(tier: PlanTier, period: BillingPeriod): PriceConfig {
  const key = TIER_PERIOD_KEYS[tier][period]
  const config = STRIPE_PRICES[key]
  if (!config?.priceId) {
    throw new Error(
      `No Stripe price configured for tier ${tier} (${period}). Set STRIPE_PRICE_* env vars.`,
    )
  }
  return config
}

export function buildPriceIdToTierMap(): Record<string, PlanTier> {
  const map: Record<string, PlanTier> = {}
  for (const config of Object.values(STRIPE_PRICES)) {
    if (config.priceId) map[config.priceId] = config.tier
  }
  map['price_1TAlJjCaljka9gJthGTMogQb'] = 2
  return map
}

export function getTierFromPriceId(priceId: string): PlanTier | null {
  return buildPriceIdToTierMap()[priceId] ?? null
}

/** Monthly price IDs for billing page Stripe product name fetch (legacy path). */
export function getMonthlyPriceIds(): string[] {
  return [1, 2, 3].map((tier) => getPriceConfig(tier as PlanTier, 'monthly').priceId)
}

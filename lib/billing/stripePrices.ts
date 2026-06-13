// Single source of truth for Stripe price IDs (from env) and display metadata.

import {
  CONSUMER_STRIPE_PRICE_ENV_VARS,
  type ConsumerStripePriceEnvVar,
} from '@/lib/env/manifest'

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

type PriceMeta = Omit<PriceConfig, 'priceId'> & {
  envVar: ConsumerStripePriceEnvVar
  legacyFallback: string
}

/** Legacy monthly price IDs — used when env vars are unset (local/preview). */
const LEGACY_MONTHLY_PRICE_IDS = {
  financial: 'price_1TILBRCaljka9gJt6dr44Znq',
  retirement: 'price_1TILEXCaljka9gJtrHqnG3bl',
  estate: 'price_1TILGOCaljka9gJtCDLiKFHp',
} as const

const PRICE_META: Record<string, PriceMeta> = {
  financial_monthly: {
    envVar: 'STRIPE_PRICE_FINANCIAL_MONTHLY',
    legacyFallback: LEGACY_MONTHLY_PRICE_IDS.financial,
    tier: 1,
    period: 'monthly',
    monthlyEquivalent: 29,
    annualTotal: 0,
    trialDays: 0,
  },
  financial_annual: {
    envVar: 'STRIPE_PRICE_FINANCIAL_ANNUAL',
    legacyFallback: '',
    tier: 1,
    period: 'annual',
    monthlyEquivalent: 24,
    annualTotal: 290,
    trialDays: 0,
  },
  retirement_monthly: {
    envVar: 'STRIPE_PRICE_RETIREMENT_MONTHLY',
    legacyFallback: LEGACY_MONTHLY_PRICE_IDS.retirement,
    tier: 2,
    period: 'monthly',
    monthlyEquivalent: 79,
    annualTotal: 0,
    trialDays: 0,
  },
  retirement_annual: {
    envVar: 'STRIPE_PRICE_RETIREMENT_ANNUAL',
    legacyFallback: '',
    tier: 2,
    period: 'annual',
    monthlyEquivalent: 66,
    annualTotal: 790,
    trialDays: 0,
  },
  estate_monthly: {
    envVar: 'STRIPE_PRICE_ESTATE_MONTHLY',
    legacyFallback: LEGACY_MONTHLY_PRICE_IDS.estate,
    tier: 3,
    period: 'monthly',
    monthlyEquivalent: 149,
    annualTotal: 0,
    trialDays: 14,
  },
  estate_annual: {
    envVar: 'STRIPE_PRICE_ESTATE_ANNUAL',
    legacyFallback: '',
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

const resolvedPriceCache = new Map<string, string>()
let priceIdToTierMap: Record<string, PlanTier> | null = null

/** Resolve-time guard: refuse fallback IDs in Vercel production. */
export function resolveConsumerPriceId(
  envVarName: ConsumerStripePriceEnvVar,
  legacyFallback: string,
): string {
  const trimmed = process.env[envVarName]?.trim()
  if (trimmed) return trimmed
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(`${envVarName} is unset in production`)
  }
  return legacyFallback
}

function metaKey(tier: PlanTier, period: BillingPeriod): string {
  return TIER_PERIOD_KEYS[tier][period]
}

function getResolvedPriceId(key: string): string {
  const cached = resolvedPriceCache.get(key)
  if (cached !== undefined) return cached

  const meta = PRICE_META[key]
  const priceId = resolveConsumerPriceId(meta.envVar, meta.legacyFallback)
  resolvedPriceCache.set(key, priceId)
  return priceId
}

/** Non-throwing snapshot for tier maps at import (no checkout path). */
function snapshotPriceIdForMap(envVarName: ConsumerStripePriceEnvVar, legacyFallback: string): string {
  const trimmed = process.env[envVarName]?.trim()
  if (trimmed) return trimmed
  if (process.env.VERCEL_ENV === 'production') return ''
  return legacyFallback
}

export function hasPriceConfig(tier: PlanTier, period: BillingPeriod): boolean {
  const key = metaKey(tier, period)
  const meta = PRICE_META[key]
  if (process.env[meta.envVar]?.trim()) return true
  if (process.env.VERCEL_ENV === 'production') return false
  return Boolean(meta.legacyFallback)
}

/** True when all three annual Stripe price IDs are set (env or preview/local fallback). */
export function isAnnualBillingConfigured(): boolean {
  return ([1, 2, 3] as PlanTier[]).every((tier) => hasPriceConfig(tier, 'annual'))
}

export function getPriceConfig(tier: PlanTier, period: BillingPeriod): PriceConfig {
  const key = metaKey(tier, period)
  const meta = PRICE_META[key]
  const priceId = getResolvedPriceId(key)
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for tier ${tier} (${period}). Set ${meta.envVar}.`,
    )
  }
  return {
    priceId,
    tier: meta.tier,
    period: meta.period,
    monthlyEquivalent: meta.monthlyEquivalent,
    annualTotal: meta.annualTotal,
    trialDays: meta.trialDays,
  }
}

export function buildPriceIdToTierMap(): Record<string, PlanTier> {
  if (priceIdToTierMap) return priceIdToTierMap

  const map: Record<string, PlanTier> = {}
  for (const meta of Object.values(PRICE_META)) {
    const priceId = snapshotPriceIdForMap(meta.envVar, meta.legacyFallback)
    if (priceId) map[priceId] = meta.tier
  }
  map['price_1TAlJjCaljka9gJthGTMogQb'] = 2
  priceIdToTierMap = map
  return map
}

export function getTierFromPriceId(priceId: string): PlanTier | null {
  return buildPriceIdToTierMap()[priceId] ?? null
}

/** Monthly price IDs for billing page Stripe product name fetch (legacy path). */
export function getMonthlyPriceIds(): string[] {
  return [1, 2, 3].map((tier) => getPriceConfig(tier as PlanTier, 'monthly').priceId)
}

export function findConsumerPriceByPriceId(priceId: string): PriceConfig | null {
  for (const tier of [1, 2, 3] as PlanTier[]) {
    for (const period of ['monthly', 'annual'] as BillingPeriod[]) {
      try {
        const config = getPriceConfig(tier, period)
        if (config.priceId === priceId) return config
      } catch {
        continue
      }
    }
  }
  return null
}

/** @internal Test helper — reset module caches between env-scoped unit tests. */
export function __resetStripePriceCachesForTests(): void {
  resolvedPriceCache.clear()
  priceIdToTierMap = null
}

/** Re-export for drift checks — guard and verifier share this list. */
export { CONSUMER_STRIPE_PRICE_ENV_VARS }

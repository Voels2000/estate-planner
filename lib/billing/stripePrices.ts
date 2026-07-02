// Single source of truth for Stripe price IDs (from env) and display metadata.

import {
  CONSUMER_STRIPE_PRICE_ENV_VARS,
  ONE_TIME_STRIPE_PRICE_ENV_VARS,
  type ConsumerStripePriceEnvVar,
  type OneTimeStripePriceEnvVar,
} from '@/lib/env/manifest'
import {
  CONSUMER_ANNUAL_TOTALS,
  CONSUMER_TIERS,
  consumerAnnualMonthlyEquivalentForPlanTier,
} from '@/lib/pricing/connectionPricing'

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
    monthlyEquivalent: CONSUMER_TIERS.financial,
    annualTotal: 0,
    trialDays: 0,
  },
  financial_annual: {
    envVar: 'STRIPE_PRICE_FINANCIAL_ANNUAL',
    legacyFallback: '',
    tier: 1,
    period: 'annual',
    monthlyEquivalent: consumerAnnualMonthlyEquivalentForPlanTier(1),
    annualTotal: CONSUMER_ANNUAL_TOTALS.financial,
    trialDays: 0,
  },
  retirement_monthly: {
    envVar: 'STRIPE_PRICE_RETIREMENT_MONTHLY',
    legacyFallback: LEGACY_MONTHLY_PRICE_IDS.retirement,
    tier: 2,
    period: 'monthly',
    monthlyEquivalent: CONSUMER_TIERS.retirement,
    annualTotal: 0,
    trialDays: 0,
  },
  retirement_annual: {
    envVar: 'STRIPE_PRICE_RETIREMENT_ANNUAL',
    legacyFallback: '',
    tier: 2,
    period: 'annual',
    monthlyEquivalent: consumerAnnualMonthlyEquivalentForPlanTier(2),
    annualTotal: CONSUMER_ANNUAL_TOTALS.retirement,
    trialDays: 0,
  },
  estate_monthly: {
    envVar: 'STRIPE_PRICE_ESTATE_MONTHLY',
    legacyFallback: LEGACY_MONTHLY_PRICE_IDS.estate,
    tier: 3,
    period: 'monthly',
    monthlyEquivalent: CONSUMER_TIERS.estate,
    annualTotal: 0,
    trialDays: 0,
  },
  estate_annual: {
    envVar: 'STRIPE_PRICE_ESTATE_ANNUAL',
    legacyFallback: '',
    tier: 3,
    period: 'annual',
    monthlyEquivalent: consumerAnnualMonthlyEquivalentForPlanTier(3),
    annualTotal: CONSUMER_ANNUAL_TOTALS.estate,
    trialDays: 0,
  },
}

export const PLAN_AND_EXPORT_SKU = 'plan_and_export' as const

export type OneTimeSkuKey = keyof typeof ONE_TIME_SKU_META

type OneTimeSkuMeta = {
  sku: typeof PLAN_AND_EXPORT_SKU
  envVar: OneTimeStripePriceEnvVar
  legacyFallback: string
  /** Derived from estate_annual.annualTotal — never hardcode cents elsewhere. */
  get amountCents(): number
}

/** One-time SKUs — never add to buildPriceIdToTierMap / PRICE_ID_TO_TIER. */
export const ONE_TIME_SKU_META = {
  PLAN_AND_EXPORT: {
    sku: PLAN_AND_EXPORT_SKU,
    envVar: 'STRIPE_PRICE_PLAN_AND_EXPORT',
    legacyFallback: '',
    get amountCents() {
      return PRICE_META.estate_annual.annualTotal * 100
    },
  },
} satisfies Record<string, OneTimeSkuMeta>

const TIER_PERIOD_KEYS: Record<PlanTier, Record<BillingPeriod, string>> = {
  1: { monthly: 'financial_monthly', annual: 'financial_annual' },
  2: { monthly: 'retirement_monthly', annual: 'retirement_annual' },
  3: { monthly: 'estate_monthly', annual: 'estate_annual' },
}

const resolvedPriceCache = new Map<string, string>()
let priceIdToTierMap: Record<string, PlanTier> | null = null

/** Resolve-time guard: refuse fallback IDs in Vercel production. */
export function resolveConsumerPriceId(
  envVarName: ConsumerStripePriceEnvVar | OneTimeStripePriceEnvVar,
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
function snapshotPriceIdForMap(
  envVarName: ConsumerStripePriceEnvVar | OneTimeStripePriceEnvVar,
  legacyFallback: string,
): string {
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

/** Display-only metadata — safe in client bundles (no Stripe price ID resolution). */
export function getConsumerPlanDisplay(
  tier: PlanTier,
  period: BillingPeriod,
): Pick<PriceConfig, 'tier' | 'period' | 'monthlyEquivalent' | 'annualTotal' | 'trialDays'> {
  const key = metaKey(tier, period)
  const meta = PRICE_META[key]
  return {
    tier: meta.tier,
    period: meta.period,
    monthlyEquivalent: meta.monthlyEquivalent,
    annualTotal: meta.annualTotal,
    trialDays: meta.trialDays,
  }
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
  // Guard: one-time prices must never map to subscription tiers (webhook uses getTierFromPriceId).
  for (const skuMeta of Object.values(ONE_TIME_SKU_META)) {
    const oneTimePriceId = snapshotPriceIdForMap(skuMeta.envVar, skuMeta.legacyFallback)
    if (oneTimePriceId && map[oneTimePriceId] !== undefined) {
      throw new Error(
        `One-time price ${skuMeta.envVar} must not appear in PRICE_ID_TO_TIER`,
      )
    }
  }
  priceIdToTierMap = map
  return map
}

export function resolveOneTimePriceId(envVarName: OneTimeStripePriceEnvVar, legacyFallback: string): string {
  return resolveConsumerPriceId(envVarName, legacyFallback)
}

export function getOneTimeSkuConfig(key: OneTimeSkuKey): {
  sku: typeof PLAN_AND_EXPORT_SKU
  priceId: string
  amountCents: number
} {
  const meta = ONE_TIME_SKU_META[key]
  const priceId = resolveOneTimePriceId(meta.envVar, meta.legacyFallback)
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for one-time SKU ${meta.sku}. Set ${meta.envVar}.`,
    )
  }
  return { sku: meta.sku, priceId, amountCents: meta.amountCents }
}

export function isPlanAndExportSku(value: string | null | undefined): boolean {
  return value === PLAN_AND_EXPORT_SKU
}

export function isPlanAndExportPriceId(priceId: string): boolean {
  try {
    return getOneTimeSkuConfig('PLAN_AND_EXPORT').priceId === priceId
  } catch {
    return false
  }
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
export { CONSUMER_STRIPE_PRICE_ENV_VARS, ONE_TIME_STRIPE_PRICE_ENV_VARS }

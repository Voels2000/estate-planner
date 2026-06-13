import { findConsumerPriceByPriceId } from '@/lib/billing/stripePrices'
import {
  ADVISOR_FIRM_SEAT_RATES,
  ATTORNEY_PLAN_LIMITS,
  TIER_PRICES,
  type AttorneyPlanKey,
} from '@/lib/tiers'

type PaidProfile = {
  consumer_tier: number | null
  subscription_status: string | null
  subscription_plan: string | null
  attorney_tier: number | null
}

type ActiveFirm = {
  seat_count: number | null
  tier: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

function isActivePaid(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(status ?? '')
}

/** Monthly revenue for one consumer subscription (annual subs use monthly equivalent). */
export function consumerMonthlyRevenue(
  priceId: string | null | undefined,
  consumerTier: number | null | undefined,
): number {
  if (priceId) {
    const config = findConsumerPriceByPriceId(priceId)
    if (config) return config.monthlyEquivalent
  }

  const tier = consumerTier ?? 1
  if (tier >= 1 && tier <= 3) {
    return TIER_PRICES[tier as 1 | 2 | 3]
  }
  return 0
}

function attorneyPlanKey(tier: number): AttorneyPlanKey {
  return tier >= 2 ? 'growth' : 'starter'
}

export function computeAdminMrr(
  profiles: PaidProfile[],
  activeFirms: ActiveFirm[],
): { consumerMrr: number; firmMrr: number; attorneyMrr: number; mrr: number } {
  const consumerMrr = profiles
    .filter((p) => isActivePaid(p.subscription_status) && (p.consumer_tier ?? 0) >= 1)
    .reduce(
      (sum, p) => sum + consumerMonthlyRevenue(p.subscription_plan, p.consumer_tier),
      0,
    )

  const firmMrr = activeFirms.reduce((sum, firm) => {
    const tierKey = firm.tier ?? 'starter'
    const rate = ADVISOR_FIRM_SEAT_RATES[tierKey] ?? ADVISOR_FIRM_SEAT_RATES.starter
    const seats = firm.seat_count ?? 1
    return sum + seats * rate
  }, 0)

  const attorneyMrr = profiles
    .filter((p) => isActivePaid(p.subscription_status) && (p.attorney_tier ?? 0) >= 1)
    .reduce((sum, p) => {
      const key = attorneyPlanKey(p.attorney_tier ?? 1)
      return sum + ATTORNEY_PLAN_LIMITS[key].priceMonthly
    }, 0)

  return {
    consumerMrr,
    firmMrr,
    attorneyMrr,
    mrr: consumerMrr + firmMrr + attorneyMrr,
  }
}

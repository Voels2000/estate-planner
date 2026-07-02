import { findConsumerPriceByPriceId } from '@/lib/billing/stripePrices'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveAttorneyBillableQuantity } from '@/lib/billing/attorneyBillableQuantity'
import { resolveStickyBillableQuantity } from '@/lib/billing/firmConnectionStickyFloor'
import {
  rateForCount,
  ADVISOR_BANDS,
  ADVISOR_FLOOR,
  ATTORNEY_BANDS,
  ATTORNEY_FLOOR,
} from '@/lib/pricing/connectionPricing'
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
  billing_floor?: number | null
  connected_count?: number | null
}

export type ActiveAttorneyListing = {
  billing_floor: number | null
  connected_count: number | null
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

export function attorneyListingMonthlyRevenue(listing: ActiveAttorneyListing): number {
  const connected = Math.max(0, Math.floor(listing.connected_count ?? 0))
  const floor = Math.max(0, Math.floor(listing.billing_floor ?? 0))
  const billable = resolveAttorneyBillableQuantity(connected, floor)
  if (billable < 1) return 0
  const rate = rateForCount(billable, ATTORNEY_BANDS, ATTORNEY_FLOOR)
  return billable * rate
}

export function firmConnectionMonthlyRevenue(
  firm: Pick<ActiveFirm, 'billing_floor' | 'connected_count'>,
): number {
  const connected = Math.max(0, Math.floor(firm.connected_count ?? 0))
  const floor = Math.max(0, Math.floor(firm.billing_floor ?? 0))
  const billable = resolveStickyBillableQuantity(connected, floor)
  if (billable < 1) return 0
  const rate = rateForCount(billable, ADVISOR_BANDS, ADVISOR_FLOOR)
  return billable * rate
}

export function computeAdminMrr(
  profiles: PaidProfile[],
  activeFirms: ActiveFirm[],
  activeAttorneyListings: ActiveAttorneyListing[] = [],
): { consumerMrr: number; firmMrr: number; attorneyMrr: number; mrr: number } {
  const consumerMrr = profiles
    .filter((p) => isActivePaid(p.subscription_status) && (p.consumer_tier ?? 0) >= 1)
    .reduce(
      (sum, p) => sum + consumerMonthlyRevenue(p.subscription_plan, p.consumer_tier),
      0,
    )

  const firmMrr = activeFirms.reduce((sum, firm) => {
    if (isConnectionBillingEnabled()) {
      return sum + firmConnectionMonthlyRevenue(firm)
    }
    const tierKey = firm.tier ?? 'starter'
    const rate = ADVISOR_FIRM_SEAT_RATES[tierKey] ?? ADVISOR_FIRM_SEAT_RATES.starter
    const seats = firm.seat_count ?? 1
    return sum + seats * rate
  }, 0)

  let attorneyMrr = 0
  if (isConnectionBillingEnabled() && activeAttorneyListings.length > 0) {
    attorneyMrr = activeAttorneyListings.reduce(
      (sum, listing) => sum + attorneyListingMonthlyRevenue(listing),
      0,
    )
  } else {
    attorneyMrr = profiles
      .filter((p) => isActivePaid(p.subscription_status) && (p.attorney_tier ?? 0) >= 1)
      .reduce((sum, p) => {
        const key = attorneyPlanKey(p.attorney_tier ?? 1)
        return sum + ATTORNEY_PLAN_LIMITS[key].priceMonthly
      }, 0)
  }

  return {
    consumerMrr,
    firmMrr,
    attorneyMrr,
    mrr: consumerMrr + firmMrr + attorneyMrr,
  }
}

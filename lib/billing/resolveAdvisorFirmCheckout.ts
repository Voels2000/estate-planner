import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveConnectionStripePriceIds } from '@/lib/pricing/connectionPricing'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'

export type FirmTierKey = keyof typeof ADVISOR_FIRM_PRICE_IDS

/** Checkout price for firm owner: connection volume price when flag on, else legacy per-seat tier. */
export function resolveAdvisorFirmCheckoutPriceId(
  firmTierKey?: string | null,
): string {
  if (isConnectionBillingEnabled()) {
    return resolveConnectionStripePriceIds().advisor
  }

  const tier =
    firmTierKey && firmTierKey in ADVISOR_FIRM_PRICE_IDS
      ? (firmTierKey as FirmTierKey)
      : 'starter'
  return ADVISOR_FIRM_PRICE_IDS[tier]
}

export function advisorConnectionCheckoutPriceId(): string {
  return resolveConnectionStripePriceIds().advisor
}

export function isAdvisorConnectionCheckoutPrice(priceId: string): boolean {
  const connectionId = advisorConnectionCheckoutPriceId()
  return Boolean(connectionId) && priceId === connectionId
}

/** Price IDs accepted by POST /api/stripe/firm-checkout for the current flag state. */
export function allowedAdvisorFirmCheckoutPriceIds(): Set<string> {
  const ids = new Set(
    Object.values(ADVISOR_FIRM_PRICE_IDS).filter((id): id is string => Boolean(id)),
  )
  const connectionId = advisorConnectionCheckoutPriceId()
  if (isConnectionBillingEnabled() && connectionId) {
    ids.add(connectionId)
  }
  return ids
}

export const LEGACY_FIRM_CHECKOUT_QUANTITY_MAX = 250

export const LEGACY_FIRM_TIER_BAND_MAX: Record<string, number> = {
  [ADVISOR_FIRM_PRICE_IDS.starter]: 10,
  [ADVISOR_FIRM_PRICE_IDS.growth]: 50,
  [ADVISOR_FIRM_PRICE_IDS.enterprise]: 250,
}

export const LEGACY_FIRM_TIER_BAND_MIN: Record<string, number> = {
  [ADVISOR_FIRM_PRICE_IDS.starter]: 1,
  [ADVISOR_FIRM_PRICE_IDS.growth]: 11,
  [ADVISOR_FIRM_PRICE_IDS.enterprise]: 51,
}

/** Normalize checkout quantity for legacy per-seat vs connection household metering. */
export function normalizeFirmCheckoutQuantity(
  priceId: string,
  rawQuantity: unknown,
  fallbackQuantity: number,
): { quantity: number; error?: string } {
  const fallback = Math.max(1, Math.floor(fallbackQuantity) || 1)
  const requested =
    typeof rawQuantity === 'number' && Number.isFinite(rawQuantity)
      ? Math.floor(rawQuantity)
      : fallback

  if (isAdvisorConnectionCheckoutPrice(priceId)) {
    const quantity = Math.min(Math.max(1, requested), LEGACY_FIRM_CHECKOUT_QUANTITY_MAX)
    return { quantity }
  }

  const minSeats = LEGACY_FIRM_TIER_BAND_MIN[priceId] ?? 1
  const maxSeats = LEGACY_FIRM_TIER_BAND_MAX[priceId] ?? LEGACY_FIRM_CHECKOUT_QUANTITY_MAX
  const quantity = Math.min(Math.max(minSeats, requested), maxSeats)

  if (requested < minSeats) {
    return {
      quantity,
      error: `Minimum seat count for this plan is ${minSeats}`,
    }
  }
  if (requested > maxSeats) {
    return {
      quantity,
      error: `Seat count exceeds maximum for this plan (${maxSeats})`,
    }
  }
  return { quantity }
}

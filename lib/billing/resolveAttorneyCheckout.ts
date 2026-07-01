import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { attorneyCheckoutQuantityFromConnected } from '@/lib/billing/attorneyBillableQuantity'
import { resolveConnectionStripePriceIds } from '@/lib/pricing/connectionPricing'
import { ATTORNEY_PLAN_PRICE_IDS } from '@/lib/tiers'

export function attorneyConnectionCheckoutPriceId(): string {
  return resolveConnectionStripePriceIds().attorney
}

export function isAttorneyConnectionCheckoutPrice(priceId: string): boolean {
  const connectionId = attorneyConnectionCheckoutPriceId()
  return Boolean(connectionId) && priceId === connectionId
}

/** Price IDs accepted by POST /api/stripe/attorney-checkout for the current flag state. */
export function allowedAttorneyCheckoutPriceIds(): Set<string> {
  const ids = new Set(
    Object.values(ATTORNEY_PLAN_PRICE_IDS).filter(
      (id): id is string => Boolean(id) && !id.startsWith('TODO_'),
    ),
  )
  const connectionId = attorneyConnectionCheckoutPriceId()
  if (isConnectionBillingEnabled() && connectionId) {
    ids.add(connectionId)
  }
  return ids
}

export function resolveAttorneyCheckoutPriceId(planKey?: string | null): string {
  if (isConnectionBillingEnabled()) {
    return attorneyConnectionCheckoutPriceId()
  }
  if (planKey && planKey in ATTORNEY_PLAN_PRICE_IDS) {
    return ATTORNEY_PLAN_PRICE_IDS[planKey as keyof typeof ATTORNEY_PLAN_PRICE_IDS]
  }
  return ATTORNEY_PLAN_PRICE_IDS.starter
}

export function normalizeAttorneyCheckoutQuantity(
  priceId: string,
  requestedQuantity: unknown,
  connectedCount: number,
  billingFloor: number | null | undefined,
): { quantity: number; error?: string } {
  if (isAttorneyConnectionCheckoutPrice(priceId)) {
    const fromBody =
      typeof requestedQuantity === 'number' && Number.isFinite(requestedQuantity)
        ? requestedQuantity
        : null
    return attorneyCheckoutQuantityFromConnected(
      connectedCount,
      billingFloor,
      fromBody,
    )
  }

  return { quantity: 1 }
}

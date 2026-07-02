/**
 * Attorney connection billing — free-client offset (Phase 6).
 * Advisor math is unchanged; do not apply FREE_CLIENTS to firm billing.
 */

export const ATTORNEY_FREE_CLIENTS = 1

/** Billable households before sticky floor (connected minus free offset). */
export function attorneyBillableBeforeFloor(connectedCount: number): number {
  const connected = Math.max(0, Math.floor(connectedCount))
  return Math.max(0, connected - ATTORNEY_FREE_CLIENTS)
}

/**
 * Stripe billable quantity with Q2: lone free client = $0 (ignores floor).
 */
export function resolveAttorneyBillableQuantity(
  connectedCount: number,
  billingFloor: number | null | undefined,
): number {
  const connected = Math.max(0, Math.floor(connectedCount))
  if (connected <= ATTORNEY_FREE_CLIENTS) {
    return 0
  }
  const beforeFloor = attorneyBillableBeforeFloor(connected)
  const floor = Math.max(0, Math.floor(billingFloor ?? 0))
  return Math.max(beforeFloor, floor)
}

/** Billable qty after connecting one more household (gate / checkout default). */
export function attorneyProjectedBillableAfterConnect(connectedCount: number): number {
  const connected = Math.max(0, Math.floor(connectedCount))
  return attorneyBillableBeforeFloor(connected + 1)
}

/** Checkout quantity for Stripe line item when billable ≥ 1. */
export function attorneyCheckoutQuantityFromConnected(
  connectedCount: number,
  billingFloor: number | null | undefined,
  requestedQuantity?: number | null,
): { quantity: number; error?: string } {
  const projectedBillable = attorneyProjectedBillableAfterConnect(connectedCount)
  const floor = Math.max(0, Math.floor(billingFloor ?? 0))
  const fromBody =
    typeof requestedQuantity === 'number' && Number.isFinite(requestedQuantity)
      ? Math.floor(requestedQuantity)
      : null
  const defaultQty = Math.max(projectedBillable, floor, 1)
  const quantity = fromBody ?? defaultQty
  if (quantity < 1) {
    return { quantity: 1, error: 'quantity must be at least 1' }
  }
  return { quantity }
}

/** Ratchet floor on billable high-water, not raw connected. */
export function computeAttorneyRatchetedBillingFloor(
  currentFloor: number | null | undefined,
  connectedCount: number,
): number {
  const prior = Math.max(0, Math.floor(currentFloor ?? 0))
  const billable = attorneyBillableBeforeFloor(connectedCount)
  return billable > prior ? billable : prior
}

/** Webhook seed: Stripe qty is billable; ceiling includes the free client. */
export function attorneyConnectionLimitSeedFromCheckoutQuantity(purchasedQuantity: number): {
  client_limit: number
  billing_floor: number
} {
  const billable = Math.max(1, Math.floor(purchasedQuantity) || 1)
  return {
    billing_floor: billable,
    client_limit: billable + ATTORNEY_FREE_CLIENTS,
  }
}

/** Reset path: ceiling stays raw; floor is billable headroom. */
export function attorneyBillingFloorFromClientLimit(clientLimit: number): number {
  const limit = Math.max(1, Math.floor(clientLimit))
  return Math.max(0, limit - ATTORNEY_FREE_CLIENTS)
}

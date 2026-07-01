import type { SupabaseClient } from '@supabase/supabase-js'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { firmConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import {
  ADVISOR_BANDS,
  ADVISOR_FLOOR,
  bandForCount,
  rateForCount,
} from '@/lib/pricing/connectionPricing'

/** Self-serve resets allowed before admin intervention (lifetime until admin reset). */
export const MAX_SELF_SERVE_RESETS = 2

export type FirmStickyFloorRow = {
  client_limit: number | null
  billing_floor: number | null
  reset_count: number | null
}

export type LimitRaiseRequiredBody = {
  error: 'limit_raise_required'
  currentLimit: number
  connected_count: number
}

/** Pure ratchet: returns new floor; never less than currentFloor. */
export function computeRatchetedBillingFloor(
  currentFloor: number | null | undefined,
  connectedCount: number,
): number {
  const floor = Math.max(0, Math.floor(currentFloor ?? 0))
  const connected = Math.max(0, Math.floor(connectedCount))
  return connected > floor ? connected : floor
}

/** Billable Stripe quantity for B2 sticky-floor model. */
export function resolveStickyBillableQuantity(
  connectedCount: number,
  billingFloor: number | null | undefined,
): number {
  const connected = Math.max(0, Math.floor(connectedCount))
  const floor = Math.max(0, Math.floor(billingFloor ?? 0))
  return Math.max(connected, floor)
}

export function wouldExceedClientLimit(
  connectedCount: number,
  clientLimit: number | null | undefined,
  addsNewBillableHousehold: boolean,
): boolean {
  if (!addsNewBillableHousehold) return false
  const limit = Math.max(1, Math.floor(clientLimit ?? 1))
  const connected = Math.max(0, Math.floor(connectedCount))
  return connected + 1 > limit
}

/** Create-time checkout seed only — never call from subscription.updated. */
export function connectionLimitSeedFromCheckoutQuantity(purchasedQuantity: number): {
  client_limit: number
  billing_floor: number
} {
  const qty = Math.max(1, Math.floor(purchasedQuantity) || 1)
  return { client_limit: qty, billing_floor: qty }
}

export type RebandPreview = {
  newLimit: number
  connectedCount: number
  oldBandLabel: string
  newBandLabel: string
  oldRatePerClient: number
  newRatePerClient: number
  newMonthlyEstimate: number
  resetCountAfter: number
  selfServeResetsRemaining: number
}

export function buildRebandPreview(opts: {
  currentLimit: number
  newLimit: number
  connectedCount: number
  resetCount: number
}): RebandPreview {
  const newLimit = Math.max(1, Math.floor(opts.newLimit))
  const currentLimit = Math.max(1, Math.floor(opts.currentLimit))
  const connectedCount = Math.max(0, Math.floor(opts.connectedCount))
  const oldBand = bandForCount(currentLimit, ADVISOR_BANDS)
  const newBand = bandForCount(newLimit, ADVISOR_BANDS)
  const oldRate = rateForCount(currentLimit, ADVISOR_BANDS, ADVISOR_FLOOR)
  const newRate = rateForCount(newLimit, ADVISOR_BANDS, ADVISOR_FLOOR)
  return {
    newLimit,
    connectedCount,
    oldBandLabel: oldBand.label,
    newBandLabel: newBand.label,
    oldRatePerClient: oldRate,
    newRatePerClient: newRate,
    newMonthlyEstimate: newRate * newLimit,
    resetCountAfter: opts.resetCount + 1,
    selfServeResetsRemaining: Math.max(0, MAX_SELF_SERVE_RESETS - (opts.resetCount + 1)),
  }
}

export function validateSelfServeReset(opts: {
  newLimit: number
  connectedCount: number
  resetCount: number
}): { ok: true } | { ok: false; error: string; code: string } {
  const newLimit = Math.floor(opts.newLimit)
  const connected = Math.max(0, Math.floor(opts.connectedCount))
  if (!Number.isFinite(newLimit) || newLimit < 1) {
    return { ok: false, error: 'new_limit must be at least 1', code: 'invalid_limit' }
  }
  if (newLimit < connected) {
    return {
      ok: false,
      error: `Cannot set limit below current connected households (${connected})`,
      code: 'below_connected',
    }
  }
  if (opts.resetCount >= MAX_SELF_SERVE_RESETS) {
    return {
      ok: false,
      error:
        "You've used your 2 self-serve limit reductions. Contact support to adjust further.",
      code: 'reset_frequency_exceeded',
    }
  }
  return { ok: true }
}

export function validateRaiseClientLimit(opts: {
  currentLimit: number | null | undefined
  newLimit: number
}): { ok: true } | { ok: false; error: string } {
  const current = Math.max(1, Math.floor(opts.currentLimit ?? 1))
  const next = Math.floor(opts.newLimit)
  if (!Number.isFinite(next) || next <= current) {
    return {
      ok: false,
      error: `new_client_limit must be greater than current limit (${current})`,
    }
  }
  return { ok: true }
}

/**
 * Ratchet billing_floor UP when connected exceeds it. NEVER lowers the floor.
 * Returns the floor value after ratchet (may equal prior floor).
 */
export async function ratchetFirmBillingFloorUp(
  admin: SupabaseClient,
  firmId: string,
  connectedCount: number,
): Promise<number> {
  const { data: firm, error } = await admin
    .from('firms')
    .select('billing_floor')
    .eq('id', firmId)
    .maybeSingle()

  if (error) throw error

  const priorFloor = firm?.billing_floor ?? 0
  const nextFloor = computeRatchetedBillingFloor(priorFloor, connectedCount)

  if (nextFloor > priorFloor) {
    const { error: updateError } = await admin
      .from('firms')
      .update({
        billing_floor: nextFloor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', firmId)

    if (updateError) throw updateError
  }

  return nextFloor
}

/**
 * B2 billable quantity + ratchet-up persist. Flag-off callers use seat_count path elsewhere.
 */
export async function resolveFirmStickyFloorBillableQuantity(
  admin: SupabaseClient,
  firmId: string,
): Promise<number> {
  const connected = await firmConnectedHouseholds(admin, firmId)
  const floor = await ratchetFirmBillingFloorUp(admin, firmId, connected)
  return resolveStickyBillableQuantity(connected, floor)
}

/** Explicit reset — the ONLY path that may lower billing_floor. */
export async function applyFirmConnectionLimitReset(
  admin: SupabaseClient,
  firmId: string,
  newLimit: number,
): Promise<void> {
  const connected = await firmConnectedHouseholds(admin, firmId)
  const { data: firm, error } = await admin
    .from('firms')
    .select('client_limit, reset_count')
    .eq('id', firmId)
    .single()

  if (error || !firm) throw error ?? new Error('firm not found')

  const validation = validateSelfServeReset({
    newLimit,
    connectedCount: connected,
    resetCount: firm.reset_count ?? 0,
  })
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const limit = Math.max(1, Math.floor(newLimit))
  const { error: updateError } = await admin
    .from('firms')
    .update({
      client_limit: limit,
      billing_floor: limit,
      reset_count: (firm.reset_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', firmId)

  if (updateError) throw updateError
}

export async function applyFirmConnectionLimitRaise(
  admin: SupabaseClient,
  firmId: string,
  newLimit: number,
): Promise<void> {
  const { data: firm, error } = await admin
    .from('firms')
    .select('client_limit')
    .eq('id', firmId)
    .single()

  if (error || !firm) throw error ?? new Error('firm not found')

  const validation = validateRaiseClientLimit({
    currentLimit: firm.client_limit,
    newLimit,
  })
  if (!validation.ok) throw new Error(validation.error)

  const limit = Math.max(1, Math.floor(newLimit))
  const { error: updateError } = await admin
    .from('firms')
    .update({
      client_limit: limit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', firmId)

  if (updateError) throw updateError
}

/** Admin-only: clear self-serve reset counter. */
export async function adminClearFirmResetCount(
  admin: SupabaseClient,
  firmId: string,
): Promise<void> {
  const { error } = await admin
    .from('firms')
    .update({ reset_count: 0, updated_at: new Date().toISOString() })
    .eq('id', firmId)
  if (error) throw error
}

export function isStickyFloorConnectionBillingActive(): boolean {
  return isConnectionBillingEnabled()
}

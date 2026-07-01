import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ACTIVE_ATTORNEY_CLIENT_STATUSES } from '@/lib/attorney/attorneyClientCap'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import {
  getAttorneyListingBillingContext,
  hasActiveAttorneyBillingSubscription,
} from '@/lib/billing/attorneyConnectionStickyFloor'
import { wouldExceedClientLimit } from '@/lib/billing/firmConnectionStickyFloor'
import { syncAttorneyStripeQuantity } from '@/lib/stripe/syncAttorneyQuantity'

export { hasActiveAttorneyBillingSubscription, ACTIVE_ATTORNEY_BILLING_STATUSES } from '@/lib/billing/attorneyConnectionStickyFloor'

export type AttorneyCheckoutRequiredBody = {
  error: 'attorney_checkout_required'
  quantity: number
}

export type LimitRaiseRequiredBody = {
  error: 'limit_raise_required'
  currentLimit: number
  connected_count: number
}

export type AttorneyConnectionBillingGateFailure =
  | { kind: 'forbidden' }
  | { kind: 'listing_unclaimed' }
  | { kind: 'attorney_checkout_required'; quantity: number }
  | { kind: 'limit_raise_required'; currentLimit: number; connected_count: number }

/** True when connecting householdId would increase listing billable count. */
export async function wouldConnectAddBillableAttorneyHousehold(
  admin: SupabaseClient,
  listingId: string,
  householdId: string,
): Promise<boolean> {
  const { data: links, error } = await admin
    .from('attorney_clients')
    .select('client_id')
    .eq('attorney_id', listingId)
    .eq('client_id', householdId)
    .in('status', [...ACTIVE_ATTORNEY_CLIENT_STATUSES])

  if (error) throw error
  return (links ?? []).length === 0
}

function gateFailureToResponse(failure: AttorneyConnectionBillingGateFailure): NextResponse {
  if (failure.kind === 'forbidden' || failure.kind === 'listing_unclaimed') {
    const message =
      failure.kind === 'listing_unclaimed'
        ? 'Claim your attorney listing before connecting clients.'
        : 'Forbidden'
    return NextResponse.json({ error: message }, { status: 403 })
  }
  if (failure.kind === 'attorney_checkout_required') {
    return NextResponse.json(
      {
        error: 'attorney_checkout_required',
        quantity: failure.quantity,
      } satisfies AttorneyCheckoutRequiredBody,
      { status: 402 },
    )
  }
  return NextResponse.json(
    {
      error: 'limit_raise_required',
      currentLimit: failure.currentLimit,
      connected_count: failure.connected_count,
    } satisfies LimitRaiseRequiredBody,
    { status: 402 },
  )
}

export async function evaluateAttorneyConnectionBillingGate(
  admin: SupabaseClient,
  listingId: string,
  householdId: string,
): Promise<{ ok: true } | { ok: false; failure: AttorneyConnectionBillingGateFailure }> {
  const ctx = await getAttorneyListingBillingContext(admin, listingId)
  if (!ctx) {
    return { ok: false, failure: { kind: 'forbidden' } }
  }
  if (!ctx.profileId) {
    return { ok: false, failure: { kind: 'listing_unclaimed' } }
  }

  const addsNew = await wouldConnectAddBillableAttorneyHousehold(admin, listingId, householdId)
  if (!addsNew) {
    return { ok: true }
  }

  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const clientLimit = Math.max(1, Math.floor(ctx.clientLimit ?? 1))

  if (hasActiveAttorneyBillingSubscription(ctx.subscriptionStatus)) {
    if (wouldExceedClientLimit(connected, clientLimit, true)) {
      return {
        ok: false,
        failure: {
          kind: 'limit_raise_required',
          currentLimit: clientLimit,
          connected_count: connected,
        },
      }
    }
    return { ok: true }
  }

  if (wouldExceedClientLimit(connected, clientLimit, true)) {
    return {
      ok: false,
      failure: { kind: 'attorney_checkout_required', quantity: connected + 1 },
    }
  }

  return { ok: true }
}

export async function assessAttorneyConnectionBillingGate(
  admin: SupabaseClient,
  listingId: string,
  householdId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isConnectionBillingEnabled()) {
    return { ok: true }
  }

  const evaluation = await evaluateAttorneyConnectionBillingGate(admin, listingId, householdId)
  if (evaluation.ok) return { ok: true }
  return {
    ok: false,
    response: gateFailureToResponse(evaluation.failure),
  }
}

/** Recompute + push Stripe quantity after connect/disconnect when flag is on. */
export async function syncAttorneyConnectionBillingQuantity(
  listingId: string | null | undefined,
): Promise<void> {
  if (!isConnectionBillingEnabled() || !listingId) return
  await syncAttorneyStripeQuantity(listingId)
}

/** After a successful connect under connection billing — ratchet (if subscribed) + sync. */
export async function afterAttorneyConnectionBillingConnect(
  admin: SupabaseClient,
  listingId: string,
): Promise<void> {
  if (!isConnectionBillingEnabled()) return
  await syncAttorneyConnectionBillingQuantity(listingId)
}

/** After disconnect — recompute billable qty; floor never lowers via sync. */
export async function afterAttorneyConnectionBillingDisconnect(
  listingId: string | null | undefined,
): Promise<void> {
  await syncAttorneyConnectionBillingQuantity(listingId)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { firmConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import {
  type LimitRaiseRequiredBody,
  wouldExceedClientLimit,
} from '@/lib/billing/firmConnectionStickyFloor'
import { syncFirmStripeQuantity } from '@/lib/stripe/syncFirmQuantity'

export const ACTIVE_FIRM_BILLING_STATUSES = ['active', 'trialing'] as const

export type FirmCheckoutRequiredBody = {
  error: 'firm_checkout_required'
  quantity: number
}

export function hasActiveFirmBillingSubscription(
  subscriptionStatus: string | null | undefined,
): boolean {
  return ACTIVE_FIRM_BILLING_STATUSES.includes(
    subscriptionStatus as (typeof ACTIVE_FIRM_BILLING_STATUSES)[number],
  )
}

/** Legacy per-seat roster paths sync Stripe; connection billing syncs on client connect/disconnect only. */
export function shouldSyncFirmStripeOnRosterChange(): boolean {
  return !isConnectionBillingEnabled()
}

export async function getAdvisorFirmBillingContext(
  admin: SupabaseClient,
  advisorId: string,
): Promise<{
  firmId: string | null
  subscriptionStatus: string | null
  clientLimit: number | null
}> {
  const { data: profile } = await admin
    .from('profiles')
    .select('firm_id')
    .eq('id', advisorId)
    .maybeSingle()

  if (!profile?.firm_id) {
    return { firmId: null, subscriptionStatus: null, clientLimit: null }
  }

  const { data: firm } = await admin
    .from('firms')
    .select('subscription_status, client_limit')
    .eq('id', profile.firm_id)
    .maybeSingle()

  return {
    firmId: profile.firm_id,
    subscriptionStatus: firm?.subscription_status ?? null,
    clientLimit: firm?.client_limit ?? null,
  }
}

/** True when connecting clientUserId would increase the firm's distinct billable household count. */
export async function wouldConnectAddBillableHousehold(
  admin: SupabaseClient,
  firmId: string,
  clientUserId: string,
): Promise<boolean> {
  const { data: advisors, error: advisorsError } = await admin
    .from('profiles')
    .select('id')
    .eq('firm_id', firmId)

  if (advisorsError) throw advisorsError
  const advisorIds = (advisors ?? []).map((row) => row.id).filter(Boolean)
  if (advisorIds.length === 0) return true

  const { data: links, error: linksError } = await admin
    .from('advisor_clients')
    .select('client_id')
    .in('advisor_id', advisorIds)
    .eq('client_id', clientUserId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])

  if (linksError) throw linksError
  return (links ?? []).length === 0
}

/**
 * When CONNECTION_BILLING_ENABLED:
 * - Unpaid firm → firm_checkout_required
 * - Paid firm at client_limit → limit_raise_required (no connect, no handoff)
 */
export async function assessFirmConnectionBillingGate(
  admin: SupabaseClient,
  advisorId: string,
  clientUserId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isConnectionBillingEnabled()) {
    return { ok: true }
  }

  const { firmId, subscriptionStatus, clientLimit } =
    await getAdvisorFirmBillingContext(admin, advisorId)
  if (!firmId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const addsNew = await wouldConnectAddBillableHousehold(admin, firmId, clientUserId)
  if (!addsNew) {
    return { ok: true }
  }

  const connected = await firmConnectedHouseholds(admin, firmId)

  if (hasActiveFirmBillingSubscription(subscriptionStatus)) {
    if (wouldExceedClientLimit(connected, clientLimit, true)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'limit_raise_required',
            currentLimit: Math.max(1, Math.floor(clientLimit ?? 1)),
            connected_count: connected,
          } satisfies LimitRaiseRequiredBody,
          { status: 402 },
        ),
      }
    }
    return { ok: true }
  }

  const quantity = connected + 1
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'firm_checkout_required', quantity } satisfies FirmCheckoutRequiredBody,
      { status: 402 },
    ),
  }
}

/** Recompute + push Stripe quantity after a client connect/disconnect when flag is on. */
export async function syncFirmConnectionBillingQuantity(
  firmId: string | null | undefined,
): Promise<void> {
  if (!isConnectionBillingEnabled() || !firmId) return
  await syncFirmStripeQuantity(firmId)
}

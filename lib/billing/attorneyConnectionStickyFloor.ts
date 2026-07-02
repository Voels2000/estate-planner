import type { SupabaseClient } from '@supabase/supabase-js'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import {
  computeAttorneyRatchetedBillingFloor,
  resolveAttorneyBillableQuantity,
  attorneyBillingFloorFromClientLimit,
} from '@/lib/billing/attorneyBillableQuantity'
import {
  validateRaiseClientLimit,
  validateSelfServeReset,
} from '@/lib/billing/firmConnectionStickyFloor'
import { ATTORNEY_TIER_LIMITS } from '@/lib/attorney/attorneyTierLimits'

export const ACTIVE_ATTORNEY_BILLING_STATUSES = ['active', 'trialing'] as const

export function hasActiveAttorneyBillingSubscription(
  subscriptionStatus: string | null | undefined,
): boolean {
  return ACTIVE_ATTORNEY_BILLING_STATUSES.includes(
    subscriptionStatus as (typeof ACTIVE_ATTORNEY_BILLING_STATUSES)[number],
  )
}

export type AttorneyListingStickyRow = {
  profile_id: string | null
  client_limit: number | null
  billing_floor: number | null
  reset_count: number | null
}

export type AttorneyListingBillingContext = {
  listingId: string
  profileId: string | null
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
  clientLimit: number | null
  billingFloor: number | null
  resetCount: number | null
}

/** Legacy paid tier cap — only for backfill / transitional headroom. */
export function legacyAttorneyTierClientCap(attorneyTier: number | null | undefined): number {
  return ATTORNEY_TIER_LIMITS[attorneyTier ?? 0]?.maxClients ?? 3
}

export function computeAttorneyBackfillClientLimit(opts: {
  connectedCount: number
  attorneyTier: number | null | undefined
  subscriptionStatus: string | null | undefined
}): number {
  const connected = Math.max(0, Math.floor(opts.connectedCount))
  const paidLegacy =
    (opts.attorneyTier ?? 0) >= 1 &&
    hasActiveAttorneyBillingSubscription(opts.subscriptionStatus)
  const tierCap = paidLegacy ? legacyAttorneyTierClientCap(opts.attorneyTier) : 0
  return Math.max(1, connected, tierCap)
}

export async function getAttorneyListingBillingContext(
  admin: SupabaseClient,
  listingId: string,
): Promise<AttorneyListingBillingContext | null> {
  const { data: listing, error } = await admin
    .from('attorney_listings')
    .select('profile_id, client_limit, billing_floor, reset_count')
    .eq('id', listingId)
    .maybeSingle()

  if (error) throw error
  if (!listing) return null

  let subscriptionStatus: string | null = null
  let stripeSubscriptionId: string | null = null
  const profileId = listing.profile_id as string | null

  if (profileId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status, stripe_subscription_id')
      .eq('id', profileId)
      .maybeSingle()
    subscriptionStatus = profile?.subscription_status ?? null
    stripeSubscriptionId = profile?.stripe_subscription_id ?? null
  }

  return {
    listingId,
    profileId,
    subscriptionStatus,
    stripeSubscriptionId,
    clientLimit: listing.client_limit,
    billingFloor: listing.billing_floor,
    resetCount: listing.reset_count,
  }
}

/**
 * Ratchet billing_floor UP when connected exceeds it — ONLY when a paid connection
 * subscription exists. Pre-subscription free usage must never raise the floor.
 */
export async function ratchetAttorneyBillingFloorUp(
  admin: SupabaseClient,
  listingId: string,
  connectedCount: number,
  subscriptionStatus?: string | null,
): Promise<number> {
  const { data: listing, error } = await admin
    .from('attorney_listings')
    .select('billing_floor, profile_id')
    .eq('id', listingId)
    .maybeSingle()

  if (error) throw error

  const priorFloor = listing?.billing_floor ?? 0

  let status = subscriptionStatus
  if (status === undefined && listing?.profile_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status')
      .eq('id', listing.profile_id)
      .maybeSingle()
    status = profile?.subscription_status ?? null
  }

  if (!hasActiveAttorneyBillingSubscription(status)) {
    return priorFloor
  }

  const nextFloor = computeAttorneyRatchetedBillingFloor(priorFloor, connectedCount)

  if (nextFloor > priorFloor) {
    const { error: updateError } = await admin
      .from('attorney_listings')
      .update({
        billing_floor: nextFloor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    if (updateError) throw updateError
  }

  return nextFloor
}

/** B2 billable quantity + ratchet-up persist when subscription is active. */
export async function resolveAttorneyStickyFloorBillableQuantity(
  admin: SupabaseClient,
  listingId: string,
): Promise<number> {
  const ctx = await getAttorneyListingBillingContext(admin, listingId)
  if (!ctx || !hasActiveAttorneyBillingSubscription(ctx.subscriptionStatus)) {
    return 0
  }

  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const floor = await ratchetAttorneyBillingFloorUp(
    admin,
    listingId,
    connected,
    ctx.subscriptionStatus,
  )
  return resolveAttorneyBillableQuantity(connected, floor)
}

export async function applyAttorneyConnectionLimitReset(
  admin: SupabaseClient,
  listingId: string,
  newLimit: number,
): Promise<void> {
  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const { data: listing, error } = await admin
    .from('attorney_listings')
    .select('client_limit, reset_count')
    .eq('id', listingId)
    .single()

  if (error || !listing) throw error ?? new Error('listing not found')

  const validation = validateSelfServeReset({
    newLimit,
    connectedCount: connected,
    resetCount: listing.reset_count ?? 0,
  })
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const limit = Math.max(1, Math.floor(newLimit))
  const billableFloor = attorneyBillingFloorFromClientLimit(limit)
  const { error: updateError } = await admin
    .from('attorney_listings')
    .update({
      client_limit: limit,
      billing_floor: billableFloor,
      reset_count: (listing.reset_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateError) throw updateError
}

export async function applyAttorneyConnectionLimitRaise(
  admin: SupabaseClient,
  listingId: string,
  newLimit: number,
): Promise<void> {
  const { data: listing, error } = await admin
    .from('attorney_listings')
    .select('client_limit')
    .eq('id', listingId)
    .single()

  if (error || !listing) throw error ?? new Error('listing not found')

  const validation = validateRaiseClientLimit({
    currentLimit: listing.client_limit,
    newLimit,
  })
  if (!validation.ok) throw new Error(validation.error)

  const limit = Math.max(1, Math.floor(newLimit))
  const { error: updateError } = await admin
    .from('attorney_listings')
    .update({
      client_limit: limit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateError) throw updateError
}

export async function adminClearAttorneyResetCount(
  admin: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await admin
    .from('attorney_listings')
    .update({ reset_count: 0, updated_at: new Date().toISOString() })
    .eq('id', listingId)
  if (error) throw error
}

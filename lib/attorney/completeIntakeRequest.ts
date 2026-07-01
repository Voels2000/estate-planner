import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  countActiveAttorneyClients,
  FREE_ATTORNEY_CLIENT_CAP_MESSAGE,
  isAtAttorneyClientCap,
} from '@/lib/attorney/attorneyClientCap'
import { applyAttorneyConnectionBilling } from '@/lib/attorney/applyAttorneyConnectionBilling'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  afterAttorneyConnectionBillingConnect,
  evaluateAttorneyConnectionBillingGate,
} from '@/lib/billing/attorneyConnectionBilling'

export async function completeIntakeRequestForUser(
  userSupabase: SupabaseClient,
  userId: string,
  userEmail: string,
  intakeToken: string,
): Promise<
  | { ok: true; listingId: string }
  | {
      ok: false
      error: string
      status: number
      quantity?: number
      currentLimit?: number
      connected_count?: number
      billing_floor?: number
    }
> {
  const admin = createAdminClient()
  const token = intakeToken.trim()

  const { data: request } = await admin
    .from('attorney_intake_requests')
    .select('id, attorney_id, listing_id, client_email, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!request) {
    return { ok: false, error: 'Intake invitation not found', status: 404 }
  }

  if (new Date(request.expires_at) < new Date()) {
    await admin
      .from('attorney_intake_requests')
      .update({ status: 'expired' })
      .eq('id', request.id)
      .neq('status', 'completed')
    return { ok: false, error: 'This invitation has expired', status: 410 }
  }

  if (request.status === 'completed') {
    return { ok: true, listingId: request.listing_id ?? '' }
  }

  if (userEmail.trim().toLowerCase() !== request.client_email.trim().toLowerCase()) {
    return {
      ok: false,
      error: 'Sign in with the email address that received this invitation',
      status: 403,
    }
  }

  if (!request.listing_id) {
    return { ok: false, error: 'Attorney listing not found for this invitation', status: 404 }
  }

  const { data: household, error: householdError } = await userSupabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (householdError || !household) {
    return {
      ok: false,
      error: 'Complete your profile before connecting with your attorney',
      status: 400,
    }
  }

  const attorneyListingId = request.listing_id

  const { data: existing } = await userSupabase
    .from('attorney_clients')
    .select('id, status')
    .eq('attorney_id', attorneyListingId)
    .eq('client_id', household.id)
    .in('status', ['active', 'accepted', 'pending'])
    .maybeSingle()

  if (!existing) {
    const { data: attorneyListing } = await userSupabase
      .from('attorney_listings')
      .select('id, profile_id')
      .eq('id', attorneyListingId)
      .single()

    if (attorneyListing?.profile_id) {
      if (isConnectionBillingEnabled()) {
        const evaluation = await evaluateAttorneyConnectionBillingGate(
          admin,
          attorneyListingId,
          household.id,
        )
        if (!evaluation.ok) {
          const { failure } = evaluation
          if (failure.kind === 'listing_unclaimed') {
            return {
              ok: false,
              error: 'Claim your attorney listing before connecting clients.',
              status: 403,
            }
          }
          if (failure.kind === 'attorney_checkout_required') {
            return {
              ok: false,
              error: 'attorney_checkout_required',
              status: 402,
              quantity: failure.quantity,
            }
          }
          if (failure.kind === 'limit_raise_required') {
            return {
              ok: false,
              error: 'limit_raise_required',
              status: 402,
              currentLimit: failure.currentLimit,
              connected_count: failure.connected_count,
              billing_floor: failure.billing_floor,
            }
          }
          return { ok: false, error: 'Forbidden', status: 403 }
        }
      } else {
        const { data: attorneyProfile } = await userSupabase
          .from('profiles')
          .select('attorney_tier')
          .eq('id', attorneyListing.profile_id)
          .single()

        const activeCount = await countActiveAttorneyClients(userSupabase, attorneyListingId)
        if (isAtAttorneyClientCap(attorneyProfile?.attorney_tier ?? 0, activeCount)) {
          return { ok: false, error: FREE_ATTORNEY_CLIENT_CAP_MESSAGE, status: 403 }
        }
      }
    } else if (isConnectionBillingEnabled()) {
      return {
        ok: false,
        error: 'Claim your attorney listing before connecting clients.',
        status: 403,
      }
    }

    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await userSupabase.from('attorney_clients').insert({
      attorney_id: attorneyListingId,
      client_id: household.id,
      status: 'active',
      granted_at: now,
      granted_by: userId,
    }).select('id').single()

    if (insertError) {
      console.error('completeIntakeRequest insert error:', insertError)
      return { ok: false, error: 'Failed to grant attorney access', status: 500 }
    }

    if (inserted?.id) {
      await applyAttorneyConnectionBilling(admin, {
        clientId: userId,
        attorneyClientRowId: inserted.id,
      })
      if (isConnectionBillingEnabled()) {
        await afterAttorneyConnectionBillingConnect(admin, attorneyListingId)
      }
    }
  }

  await admin
    .from('attorney_intake_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  return { ok: true, listingId: attorneyListingId }
}

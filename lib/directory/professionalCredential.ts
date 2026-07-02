import type { SupabaseClient } from '@supabase/supabase-js'

export type ConnectCredentialInput = {
  bar_number?: string
  bar_state?: string
  crd_number?: string
}

export type CredentialGateType = 'bar' | 'crd'

export type CredentialGateBlock = {
  ok: false
  status: 403
  body: {
    error: string
    credential_required: true
    credential_type: CredentialGateType
  }
}

export type CredentialGateOk = { ok: true }

export type CredentialGateResult = CredentialGateOk | CredentialGateBlock

type AttorneyListingRow = {
  id: string
  bar_number: string | null
  state: string | null
  states_licensed: string[] | null
  credential_verified_at: string | null
}

type AdvisorListingRow = {
  id: string
  crd_number: string | null
  credential_verified_at: string | null
}

export async function getAdvisorDirectoryListingIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('advisor_directory')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  return data?.id ?? null
}

export function mergeLicensedStates(
  existing: string[] | null | undefined,
  barState: string,
): string[] {
  const merged = new Set(
    [...(existing ?? []), barState].map((s) => s.trim().toUpperCase()).filter(Boolean),
  )
  return [...merged]
}

export async function assertProfessionalCredentialForConnect(
  admin: SupabaseClient,
  opts: {
    type: 'attorney'
    listingId: string
    input: ConnectCredentialInput
  } | {
    type: 'advisor'
    listingId: string
    input: ConnectCredentialInput
  },
): Promise<CredentialGateResult> {
  if (opts.type === 'attorney') {
    const { data: listing, error } = await admin
      .from('attorney_listings')
      .select('id, bar_number, state, states_licensed, credential_verified_at')
      .eq('id', opts.listingId)
      .single<AttorneyListingRow>()

    if (error || !listing) {
      return {
        ok: false,
        status: 403,
        body: {
          error: 'Attorney listing not found',
          credential_required: true,
          credential_type: 'bar',
        },
      }
    }

    if (listing.credential_verified_at) return { ok: true }

    const barNumber = opts.input.bar_number?.trim() || listing.bar_number?.trim()
    if (!barNumber) {
      return {
        ok: false,
        status: 403,
        body: {
          error:
            'WSBA bar number required before accepting your first client connection.',
          credential_required: true,
          credential_type: 'bar',
        },
      }
    }

    const barState = (opts.input.bar_state?.trim() || listing.state || 'WA').toUpperCase()
    const now = new Date().toISOString()
    const { error: updateError } = await admin
      .from('attorney_listings')
      .update({
        bar_number: barNumber,
        credential_verified_at: now,
        states_licensed: mergeLicensedStates(listing.states_licensed, barState),
      })
      .eq('id', listing.id)

    if (updateError) {
      console.error('assertProfessionalCredentialForConnect attorney:', updateError)
      return {
        ok: false,
        status: 403,
        body: {
          error: 'Unable to save bar number. Please try again.',
          credential_required: true,
          credential_type: 'bar',
        },
      }
    }

    return { ok: true }
  }

  const { data: listing, error } = await admin
    .from('advisor_directory')
    .select('id, crd_number, credential_verified_at')
    .eq('id', opts.listingId)
    .single<AdvisorListingRow>()

  if (error || !listing) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Advisor listing not found',
        credential_required: true,
        credential_type: 'crd',
      },
    }
  }

  if (listing.credential_verified_at) return { ok: true }

  const crdNumber = opts.input.crd_number?.trim() || listing.crd_number?.trim()
  if (!crdNumber) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'CRD number required before accepting your first client connection.',
        credential_required: true,
        credential_type: 'crd',
      },
    }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('advisor_directory')
    .update({
      crd_number: crdNumber,
      credential_verified_at: now,
    })
    .eq('id', listing.id)

  if (updateError) {
    console.error('assertProfessionalCredentialForConnect advisor:', updateError)
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Unable to save CRD number. Please try again.',
        credential_required: true,
        credential_type: 'crd',
      },
    }
  }

  return { ok: true }
}

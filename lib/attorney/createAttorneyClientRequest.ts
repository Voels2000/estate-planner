import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveConsumerHouseholdId } from '@/lib/attorney/verifyAttorneyHouseholdAccess'

/** Insert attorney_clients consumer_requested when a consumer initiates connection. */
export async function ensureAttorneyClientRequestRow(
  admin: SupabaseClient,
  params: {
    attorneyListingId: string
    consumerUserId: string
    requestMessage?: string | null
  },
): Promise<{ created: boolean; rowId: string | null }> {
  const householdId = await resolveConsumerHouseholdId(admin, params.consumerUserId)
  if (!householdId) return { created: false, rowId: null }

  const { data: existing } = await admin
    .from('attorney_clients')
    .select('id, status')
    .eq('attorney_id', params.attorneyListingId)
    .eq('client_id', householdId)
    .not('status', 'in', '(removed,revoked)')
    .maybeSingle()

  if (existing) {
    if (existing.status === 'consumer_requested') return { created: false, rowId: existing.id }
    return { created: false, rowId: null }
  }

  const { data, error } = await admin
    .from('attorney_clients')
    .insert({
      attorney_id: params.attorneyListingId,
      client_id: householdId,
      status: 'consumer_requested',
      request_message: params.requestMessage?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[ensureAttorneyClientRequestRow]', error)
    return { created: false, rowId: null }
  }

  return { created: true, rowId: data.id }
}

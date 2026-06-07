import type { SupabaseClient } from '@supabase/supabase-js'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'

export const CONNECTED_ATTORNEY_CLIENT_STATUSES = ['active', 'accepted'] as const

export async function verifyAttorneyHouseholdAccess(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<
  | { ok: true; listingId: string; connectionId: string }
  | { ok: false; status: 403 | 404 }
> {
  const listingId = await getAttorneyListingIdForUser(supabase, userId)
  if (!listingId) return { ok: false, status: 404 }

  const { data: connection } = await supabase
    .from('attorney_clients')
    .select('id')
    .eq('attorney_id', listingId)
    .eq('client_id', householdId)
    .in('status', [...CONNECTED_ATTORNEY_CLIENT_STATUSES])
    .maybeSingle()

  if (!connection) return { ok: false, status: 403 }
  return { ok: true, listingId, connectionId: connection.id }
}

export async function resolveConsumerHouseholdId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

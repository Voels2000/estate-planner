import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve auth profile id for notifications from attorney_clients.attorney_id
 * (listing id in canonical model; legacy rows may store profile uuid).
 */
export async function resolveAttorneyProfileId(
  supabase: SupabaseClient,
  attorneyListingOrLegacyId: string,
): Promise<string | null> {
  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('profile_id')
    .eq('id', attorneyListingOrLegacyId)
    .maybeSingle()

  if (listing?.profile_id) return listing.profile_id

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', attorneyListingOrLegacyId)
    .eq('role', 'attorney')
    .maybeSingle()

  return profile?.id ?? null
}

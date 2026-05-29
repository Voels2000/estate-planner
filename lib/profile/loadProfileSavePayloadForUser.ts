import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildProfileInlinePayload,
  type ProfileInlineHouseholdRow,
} from '@/lib/profile/buildProfileInlinePayload'
import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

/** Load the full profile PATCH payload for merge-on-partial-update. */
export async function loadProfileSavePayloadForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSavePayload | null> {
  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
    supabase
      .from('households')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle<ProfileInlineHouseholdRow>(),
  ])

  if (!profile?.email || !household) return null
  return buildProfileInlinePayload(household, profile)
}

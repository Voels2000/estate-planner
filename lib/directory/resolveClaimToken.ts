import type { SupabaseClient } from '@supabase/supabase-js'

export type DirectoryClaimTarget =
  | {
      type: 'attorney'
      table: 'attorney_listings'
      listing: Record<string, unknown> & { id: string }
    }
  | {
      type: 'advisor'
      table: 'advisor_directory'
      listing: Record<string, unknown> & { id: string }
    }

export async function resolveDirectoryClaimToken(
  admin: SupabaseClient,
  token: string,
): Promise<DirectoryClaimTarget | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  const { data: attorney } = await admin
    .from('attorney_listings')
    .select('*')
    .eq('claim_token', trimmed)
    .maybeSingle()

  if (attorney?.id) {
    return { type: 'attorney', table: 'attorney_listings', listing: attorney }
  }

  const { data: advisor } = await admin
    .from('advisor_directory')
    .select('*')
    .eq('claim_token', trimmed)
    .maybeSingle()

  if (advisor?.id) {
    return { type: 'advisor', table: 'advisor_directory', listing: advisor }
  }

  return null
}

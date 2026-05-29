import type { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type HouseholdAccessResult =
  | { ok: true; isOwner: boolean; isAdvisor: boolean }
  | { ok: false; reason: 'not_found' | 'forbidden' }

/** Verify caller owns the household or is a connected advisor for the owner. */
export async function assertHouseholdAccess(
  supabase: ServerSupabase,
  userId: string,
  householdId: string,
): Promise<HouseholdAccessResult> {
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .maybeSingle()

  if (!household) return { ok: false, reason: 'not_found' }

  if (household.owner_id === userId) {
    return { ok: true, isOwner: true, isAdvisor: false }
  }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', userId)
    .eq('client_id', household.owner_id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (link) return { ok: true, isOwner: false, isAdvisor: true }

  return { ok: false, reason: 'forbidden' }
}

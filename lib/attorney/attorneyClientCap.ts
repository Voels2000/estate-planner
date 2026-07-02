import type { SupabaseClient } from '@supabase/supabase-js'
import { attorneyTierFeatures } from '@/lib/attorney/attorneyTierLimits'

export const ACTIVE_ATTORNEY_CLIENT_STATUSES = ['active', 'accepted'] as const

import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { freeAttorneyClientCapMessage } from '@/lib/copy/connectionBillingMarketing'

export const FREE_ATTORNEY_CLIENT_CAP_MESSAGE = 'Free plan limited to 3 client households'

export function getAttorneyClientCapMessage(): string {
  return freeAttorneyClientCapMessage()
}

export async function getAttorneyListingIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  return data?.id ?? null
}

export async function countActiveAttorneyClients(
  supabase: SupabaseClient,
  attorneyListingId: string,
): Promise<number> {
  const { count } = await supabase
    .from('attorney_clients')
    .select('id', { count: 'exact', head: true })
    .eq('attorney_id', attorneyListingId)
    .in('status', [...ACTIVE_ATTORNEY_CLIENT_STATUSES])

  return count ?? 0
}

export function isAtAttorneyClientCap(tier: number, activeCount: number): boolean {
  const limit = attorneyTierFeatures(tier).maxClients
  return activeCount >= limit
}

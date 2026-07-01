/**
 * Canonical billable household counts for connection-based professional billing (Phase 3).
 *
 * Semantics (G2 — do not assume both tables count the same thing):
 *   - advisor_clients.client_id  = consumer **user** id (proxy for household while 1:1 holds)
 *   - attorney_clients.client_id = **household** id directly
 *
 * Dedup is within firm (advisor) or within listing (attorney). Same household connected
 * through two different firms → each firm counts 1.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_ATTORNEY_CLIENT_STATUSES } from '@/lib/attorney/attorneyClientCap'
import {
  CONNECTED_ADVISOR_CLIENT_STATUSES,
  isConnectedAdvisorClientStatus,
} from '@/lib/advisor/clientConnectionStatus'

export { CONNECTED_ADVISOR_CLIENT_STATUSES }

type ClientIdRow = { client_id: string }

/** Distinct non-empty client_id values — shared dedup primitive for billing quantity. */
export function countDistinctClientIds(rows: ClientIdRow[]): number {
  const ids = new Set<string>()
  for (const row of rows) {
    const id = row.client_id?.trim()
    if (id) ids.add(id)
  }
  return ids.size
}

type AdvisorLinkRow = {
  client_id: string
  status: string
  advisor_id: string
  firm_id: string | null
}

/** Pure firm-scoped billable count from link rows (for unit tests). */
export function countBillableAdvisorHouseholdsForFirm(
  links: AdvisorLinkRow[],
  firmId: string,
): number {
  const billable = links.filter(
    (link) =>
      link.firm_id === firmId &&
      isConnectedAdvisorClientStatus(link.status),
  )
  return countDistinctClientIds(billable)
}

type AttorneyLinkRow = { client_id: string; status: string }

/** Pure listing-scoped billable count from link rows (for unit tests). */
export function countBillableAttorneyHouseholds(links: AttorneyLinkRow[]): number {
  const billable = links.filter((link) =>
    (ACTIVE_ATTORNEY_CLIENT_STATUSES as readonly string[]).includes(link.status),
  )
  return countDistinctClientIds(billable)
}

/**
 * Firm-scoped distinct connected households for advisor billing quantity.
 * COUNT(DISTINCT client_id) over advisors in the firm with connected statuses only.
 */
export async function firmConnectedHouseholds(
  supabase: SupabaseClient,
  firmId: string,
): Promise<number> {
  const { data: advisors, error: advisorsError } = await supabase
    .from('profiles')
    .select('id')
    .eq('firm_id', firmId)

  if (advisorsError) throw advisorsError
  const advisorIds = (advisors ?? []).map((row) => row.id).filter(Boolean)
  if (advisorIds.length === 0) return 0

  const { data: links, error: linksError } = await supabase
    .from('advisor_clients')
    .select('client_id')
    .in('advisor_id', advisorIds)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])

  if (linksError) throw linksError
  return countDistinctClientIds(links ?? [])
}

/**
 * Listing-scoped distinct connected households for attorney billing quantity.
 * attorney_clients.client_id is already the household id.
 */
export async function attorneyConnectedHouseholds(
  supabase: SupabaseClient,
  attorneyListingId: string,
): Promise<number> {
  const { data: links, error } = await supabase
    .from('attorney_clients')
    .select('client_id')
    .eq('attorney_id', attorneyListingId)
    .in('status', [...ACTIVE_ATTORNEY_CLIENT_STATUSES])

  if (error) throw error
  return countDistinctClientIds(links ?? [])
}

/**
 * Lightweight roster net-worth estimates for the advisor home page.
 *
 * Uses batched table reads (4 queries for all clients) instead of one
 * `calculate_estate_composition` RPC per client. Figures are approximate vs
 * the client workspace Overview tab (which uses full composition).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

function addToMap(map: Record<string, number>, ownerId: string, delta: number) {
  if (!ownerId || !Number.isFinite(delta)) return
  map[ownerId] = (map[ownerId] ?? 0) + delta
}

export async function loadRosterNetWorthByOwner(
  supabase: SupabaseClient,
  clientIds: string[],
): Promise<Record<string, number>> {
  const netWorthMap: Record<string, number> = {}
  if (clientIds.length === 0) return netWorthMap

  const uniqueIds = [...new Set(clientIds)]

  const [assetsRes, liabilitiesRes, realEstateRes, businessInterestsRes, insuranceRes] =
    await Promise.all([
      supabase.from('assets').select('owner_id, value').in('owner_id', uniqueIds),
      supabase.from('liabilities').select('owner_id, balance').in('owner_id', uniqueIds),
      supabase
        .from('real_estate')
        .select('owner_id, current_value, mortgage_balance')
        .in('owner_id', uniqueIds),
      supabase
        .from('business_interests')
        .select('owner_id, fmv_estimated')
        .in('owner_id', uniqueIds),
      supabase
        .from('insurance_policies')
        .select('owner_id, death_benefit, cash_value')
        .in('user_id', uniqueIds),
    ])

  for (const row of assetsRes.data ?? []) {
    const r = row as { owner_id: string; value: number | null }
    addToMap(netWorthMap, r.owner_id, Number(r.value) || 0)
  }

  for (const row of liabilitiesRes.data ?? []) {
    const r = row as { owner_id: string; balance: number | null }
    addToMap(netWorthMap, r.owner_id, -(Number(r.balance) || 0))
  }

  for (const row of realEstateRes.data ?? []) {
    const r = row as {
      owner_id: string
      current_value: number | null
      mortgage_balance: number | null
    }
    addToMap(netWorthMap, r.owner_id, Number(r.current_value) || 0)
    addToMap(netWorthMap, r.owner_id, -(Number(r.mortgage_balance) || 0))
  }

  for (const row of businessInterestsRes.data ?? []) {
    const r = row as { owner_id: string; fmv_estimated: number | null }
    addToMap(netWorthMap, r.owner_id, Number(r.fmv_estimated) || 0)
  }

  for (const row of insuranceRes.data ?? []) {
    const r = row as {
      owner_id?: string
      user_id?: string
      death_benefit: number | null
      cash_value: number | null
    }
    const ownerId = r.owner_id ?? r.user_id ?? ''
    const insValue = Math.max(Number(r.death_benefit) || 0, Number(r.cash_value) || 0)
    addToMap(netWorthMap, ownerId, insValue)
  }

  for (const id of uniqueIds) {
    if (netWorthMap[id] == null) netWorthMap[id] = 0
  }

  return netWorthMap
}

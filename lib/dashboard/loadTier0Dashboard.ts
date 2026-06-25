import type { SupabaseClient } from '@supabase/supabase-js'
import {
  aggregateNetWorthInputRows,
  computeNetWorthFromInputTables,
  type NetWorthInputTableRows,
} from '@/lib/dashboard/computeNetWorthFromInputTables'
import type { NetWorthSummary } from '@/lib/view-models/netWorthSummary'

export type Tier0DashboardData = {
  profile: { full_name: string | null; terms_accepted_at: string | null } | null
  netWorth: NetWorthSummary
  mortgageBalance: number
  otherLiabilities: number
  inputRows: NetWorthInputTableRows
}

/**
 * Thin dashboard loader (PR 3). Input-table queries only — never calls composition,
 * MC staleness, health recompute, or background base-case regeneration.
 */
export async function loadTier0Dashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<Tier0DashboardData> {
  const [
    { data: profile },
    { data: assets },
    { data: liabilities },
    { data: realEstate },
    { data: businesses },
    { data: businessInterests },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, terms_accepted_at').eq('id', userId).single(),
    supabase.from('assets').select('value').eq('owner_id', userId),
    supabase.from('liabilities').select('balance').eq('owner_id', userId),
    supabase.from('real_estate').select('current_value, mortgage_balance').eq('owner_id', userId),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', userId),
    supabase
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', userId),
  ])

  const inputRows: NetWorthInputTableRows = {
    assets: assets ?? [],
    liabilities: liabilities ?? [],
    realEstate: realEstate ?? [],
    businesses: businesses ?? [],
    businessInterests: businessInterests ?? [],
  }

  const agg = aggregateNetWorthInputRows(inputRows)

  return {
    profile: profile ?? null,
    netWorth: computeNetWorthFromInputTables(inputRows),
    mortgageBalance: agg.mortgageBalance,
    otherLiabilities: agg.otherLiabilities,
    inputRows,
  }
}

// lib/estate/classifyEstateAssets.ts
// TypeScript wrapper around the calculate_estate_composition Postgres RPC.
// Called server-side from page.tsx or the /api/estate-composition route.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstateComposition } from './types'

/**
 * Fetch the full estate composition for a household.
 * Returns a typed EstateComposition object.
 * All heavy lifting is done in the Postgres RPC.
 */
export async function classifyEstateAssets(
  supabase: SupabaseClient,
  householdId: string,
  sourceRole: 'consumer' | 'advisor' = 'consumer',
): Promise<EstateComposition> {
  const { data, error } = await supabase
    .rpc('calculate_estate_composition', {
      p_household_id: householdId,
      p_source_role: sourceRole,
    })

  if (error) {
    console.error('[classifyEstateAssets] RPC error:', error.message)
    return {
      success: false,
      error: error.message,
      filing_status: 'single',
      has_spouse: false,
      inside_total: 0,
      inside_financial: 0,
      inside_financial_liquid: 0,
      inside_financial_illiquid: 0,
      inside_real_estate: 0,
      inside_business_gross: 0,
      inside_business_taxable: 0,
      inside_insurance: 0,
      inside_liquid: 0,
      inside_illiquid: 0,
      outside_structure_total: 0,
      outside_structure_items: [],
      outside_strategy_total: 0,
      outside_strategy_items: [],
      gross_estate: 0,
      total_liabilities: 0,
      net_estate: 0,
      admin_expense: 0,
      admin_expense_pct: 0.02,
      valuation_discount_total: 0,
      marital_deduction: 0,
      adjusted_taxable_gifts: 0,
      taxable_estate: 0,
      exemption_available: 0,
      exemption_remaining: 0,
      estimated_tax: 0,
    }
  }

  // RPC returns a single JSONB row — Supabase wraps it as data directly
  const raw = data as EstateComposition
  return {
    ...raw,
    // Ensure arrays are never undefined (safe default for UI rendering)
    outside_structure_items: raw.outside_structure_items ?? [],
    outside_strategy_items: raw.outside_strategy_items ?? [],
  }
}

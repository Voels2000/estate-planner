import { createClient } from '@/lib/supabase/server'

export interface RefOption {
  value: string
  label: string
  description?: string | null
}

export async function fetchTitlingTypes(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_titling_types')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchLiquidityTypes(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_liquidity_types')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchAssetTypes(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asset_types')
    .select('value, label')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchBusinessEntityTypes(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('business_entity_types')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchValuationMethods(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_valuation_methods')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchSuccessionPlans(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_succession_plans')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchAllRefData() {
  const [
    titlingTypes,
    liquidityTypes,
    assetTypes,
    businessEntityTypes,
    valuationMethods,
    successionPlans,
  ] = await Promise.all([
    fetchTitlingTypes(),
    fetchLiquidityTypes(),
    fetchAssetTypes(),
    fetchBusinessEntityTypes(),
    fetchValuationMethods(),
    fetchSuccessionPlans(),
  ])

  return {
    titlingTypes,
    liquidityTypes,
    assetTypes,
    businessEntityTypes,
    valuationMethods,
    successionPlans,
  }
}

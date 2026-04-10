import { createClient } from '@/lib/supabase/server'

export interface RefOption {
  value: string
  label: string
  description?: string | null
}

export interface InsuranceTypeOption extends RefOption {
  has_death_benefit: boolean
  has_cash_value: boolean
  has_ilit_option: boolean
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

export async function fetchPropertyTypes(): Promise<RefOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_property_types')
    .select('value, label, description')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchInsuranceTypes(): Promise<InsuranceTypeOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ref_insurance_types')
    .select('value, label, description, has_death_benefit, has_cash_value, has_ilit_option')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as InsuranceTypeOption[]
}

export async function fetchAllRefData() {
  const supabase = await createClient()

  const [
    titlingTypes,
    liquidityTypes,
    assetTypes,
    businessEntityTypes,
    valuationMethods,
    successionPlans,
    propertyTypes,
    insuranceTypes,
  ] = await Promise.all([
    supabase.from('ref_titling_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_liquidity_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('asset_types').select('value, label').eq('is_active', true).order('sort_order'),
    supabase.from('business_entity_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_valuation_methods').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_succession_plans').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_property_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_insurance_types').select('value, label, description, has_death_benefit, has_cash_value, has_ilit_option').eq('is_active', true).order('sort_order'),
  ])

  return {
    titlingTypes: titlingTypes.data ?? [],
    liquidityTypes: liquidityTypes.data ?? [],
    assetTypes: assetTypes.data ?? [],
    businessEntityTypes: businessEntityTypes.data ?? [],
    valuationMethods: valuationMethods.data ?? [],
    successionPlans: successionPlans.data ?? [],
    propertyTypes: propertyTypes.data ?? [],
    insuranceTypes: insuranceTypes.data ?? [],
  }
}

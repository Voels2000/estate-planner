import type { SupabaseClient } from '@supabase/supabase-js'

export type EstatePlanningRecommendations = {
  success: boolean
  tax_year: number
  gross_estate: number
  federal_estate_tax: number
  state_estate_tax: number
  total_tax_exposure: number
  complexity_score: number
  complexity_flag: string
  needs_will: boolean
  needs_trust: boolean
  needs_pour_over_will: boolean
  needs_dpoa: boolean
  needs_healthcare_directive: boolean
  needs_ilit: boolean
  needs_bypass_trust: boolean
  needs_gifting_strategy: boolean
  recommendations: Array<{
    branch: string
    priority: 'high' | 'moderate' | 'low'
    reason: string
  }>
}

export type EstatePlanningCompleteness = {
  success: boolean
  completeness_score: number
  completeness_pct: number
  grade: string
  attorney_cta_triggered: boolean
  breakdown: {
    has_will_or_trust: boolean
    has_dpoa: boolean
    has_healthcare_directive: boolean
    has_beneficiaries: boolean
    has_tax_strategy: boolean
    will_or_trust_points: number
    dpoa_points: number
    healthcare_points: number
    beneficiary_points: number
    tax_strategy_points: number
  }
}

export async function loadEstatePlanningDashboard(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{
  recommendations: EstatePlanningRecommendations | null
  completeness: EstatePlanningCompleteness | null
  error: string | null
}> {
  const [{ data: recData, error: recError }, { data: compData, error: compError }] =
    await Promise.all([
      supabase.rpc('generate_estate_recommendations', { p_household_id: householdId }),
      supabase.rpc('calculate_estate_completeness', { p_household_id: householdId }),
    ])

  if (recError || compError) {
    return {
      recommendations: null,
      completeness: null,
      error: recError?.message ?? compError?.message ?? 'Failed to load estate planning data',
    }
  }

  return {
    recommendations: recData as EstatePlanningRecommendations,
    completeness: compData as EstatePlanningCompleteness,
    error: null,
  }
}

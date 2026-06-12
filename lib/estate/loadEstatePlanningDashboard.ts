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

function isCachedRecommendations(
  value: unknown,
): value is EstatePlanningRecommendations {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as EstatePlanningRecommendations).success === true &&
    Array.isArray((value as EstatePlanningRecommendations).recommendations)
  )
}

export type LoadEstatePlanningDashboardOptions = {
  /** Skip live generate_estate_recommendations; caller may trigger background recompute. */
  recommendationsCacheOnly?: boolean
  /** Skip calculate_estate_completeness when completeness UI is not shown. */
  skipCompleteness?: boolean
}

export async function loadEstatePlanningDashboard(
  supabase: SupabaseClient,
  householdId: string,
  options: LoadEstatePlanningDashboardOptions = {},
): Promise<{
  recommendations: EstatePlanningRecommendations | null
  completeness: EstatePlanningCompleteness | null
  error: string | null
  recommendationsPendingRecompute: boolean
}> {
  const [{ data: healthRow }, compResult] = await Promise.all([
    supabase
      .from('estate_health_scores')
      .select('recommendations')
      .eq('household_id', householdId)
      .maybeSingle(),
    options.skipCompleteness
      ? Promise.resolve({ data: null, error: null })
      : supabase.rpc('calculate_estate_completeness', { p_household_id: householdId }),
  ])
  const { data: compData, error: compError } = compResult

  let recommendations: EstatePlanningRecommendations | null = isCachedRecommendations(
    healthRow?.recommendations,
  )
    ? healthRow.recommendations
    : null

  let recommendationsPendingRecompute = false

  if (!recommendations && !options.recommendationsCacheOnly) {
    const { data: recData, error: recError } = await supabase.rpc('generate_estate_recommendations', {
      p_household_id: householdId,
    })
    if (recError) {
      return {
        recommendations: null,
        completeness: null,
        error: recError.message ?? 'Failed to load estate planning data',
        recommendationsPendingRecompute: false,
      }
    }
    recommendations = recData as EstatePlanningRecommendations
  } else if (!recommendations && options.recommendationsCacheOnly) {
    recommendationsPendingRecompute = true
  }

  if (compError) {
    return {
      recommendations: null,
      completeness: null,
      error: compError.message ?? 'Failed to load estate planning data',
      recommendationsPendingRecompute,
    }
  }

  return {
    recommendations,
    completeness: compData as EstatePlanningCompleteness | null,
    error: null,
    recommendationsPendingRecompute,
  }
}

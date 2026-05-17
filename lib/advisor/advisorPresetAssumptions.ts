import type { SupabaseClient } from '@supabase/supabase-js'

export type AdvisorPresetRow = {
  id: string
  advisor_id: string
  scenario_name: string
  is_preset: boolean
  is_default: boolean
  is_active: boolean
  return_mean_pct: number | null
  volatility_pct: number | null
  withdrawal_rate_pct: number | null
  success_threshold: number | null
  simulation_count: number | null
  planning_horizon_yr: number | null
  inflation_rate_pct: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PresetAssumptionInput = {
  scenario_name?: string
  scenarioName?: string
  is_default?: boolean
  returnMeanPct?: number | null
  volatilityPct?: number | null
  withdrawalRatePct?: number | null
  successThreshold?: number | null
  simulationCount?: number | null
  planningHorizonYr?: number | null
  inflationRatePct?: number | null
  notes?: string | null
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function validatePresetAssumptionRanges(input: PresetAssumptionInput): string[] {
  const errors: string[] = []
  const returnMeanPct = numOrNull(input.returnMeanPct)
  const volatilityPct = numOrNull(input.volatilityPct)
  const withdrawalRatePct = numOrNull(input.withdrawalRatePct)
  const successThreshold = numOrNull(input.successThreshold)
  const simulationCount = numOrNull(input.simulationCount)
  const planningHorizonYr = numOrNull(input.planningHorizonYr)
  const inflationRatePct = numOrNull(input.inflationRatePct)

  if (returnMeanPct != null && (returnMeanPct < 2.0 || returnMeanPct > 12.0)) {
    errors.push('returnMeanPct must be 2–12')
  }
  if (volatilityPct != null && (volatilityPct < 5.0 || volatilityPct > 25.0)) {
    errors.push('volatilityPct must be 5–25')
  }
  if (withdrawalRatePct != null && (withdrawalRatePct < 1.0 || withdrawalRatePct > 8.0)) {
    errors.push('withdrawalRatePct must be 1–8')
  }
  if (successThreshold != null && (successThreshold < 50.0 || successThreshold > 99.0)) {
    errors.push('successThreshold must be 50–99')
  }
  if (simulationCount != null && (simulationCount < 500 || simulationCount > 10000)) {
    errors.push('simulationCount must be 500–10000')
  }
  if (planningHorizonYr != null && (planningHorizonYr < 10 || planningHorizonYr > 50)) {
    errors.push('planningHorizonYr must be 10–50')
  }
  if (inflationRatePct != null && (inflationRatePct < 1.0 || inflationRatePct > 6.0)) {
    errors.push('inflationRatePct must be 1–6')
  }
  if (
    returnMeanPct != null &&
    inflationRatePct != null &&
    returnMeanPct - inflationRatePct <= 0
  ) {
    errors.push('Real return (returnMean − inflation) must be positive')
  }
  return errors
}

export function presetPayloadFromInput(
  advisorId: string,
  input: PresetAssumptionInput,
  overrides?: Partial<Record<string, unknown>>,
) {
  const scenarioName = (input.scenario_name ?? input.scenarioName ?? '').trim()
  return {
    advisor_id: advisorId,
    client_household_id: null,
    scenario_name: scenarioName,
    is_preset: true,
    is_active: true,
    is_default: Boolean(input.is_default),
    return_mean_pct: numOrNull(input.returnMeanPct),
    volatility_pct: numOrNull(input.volatilityPct),
    withdrawal_rate_pct: numOrNull(input.withdrawalRatePct),
    success_threshold: numOrNull(input.successThreshold),
    simulation_count: numOrNull(input.simulationCount),
    planning_horizon_yr: numOrNull(input.planningHorizonYr),
    inflation_rate_pct: numOrNull(input.inflationRatePct),
    notes: input.notes?.trim() || null,
    ...overrides,
  }
}

export async function clearAdvisorPresetDefaults(
  supabase: SupabaseClient,
  advisorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('advisor_projection_assumptions')
    .update({ is_default: false })
    .eq('advisor_id', advisorId)
    .eq('is_preset', true)

  if (error) throw new Error(error.message)
}

export async function getAdvisorPresetById(
  supabase: SupabaseClient,
  advisorId: string,
  presetId: string,
) {
  const { data, error } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('id', presetId)
    .eq('advisor_id', advisorId)
    .eq('is_preset', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as AdvisorPresetRow | null
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FanChartDataPoint, PercentileByYear } from '@/lib/calculations/estate-monte-carlo'

export interface MonteCarloSummary {
  scenario_id: string
  p10_estate: number
  p50_estate: number
  p90_estate: number
  p10_tax: number
  p50_tax: number
  p90_tax: number
  success_rate: number
  median_net_to_heirs: number
  fan_chart_data: FanChartDataPoint[]
  percentiles_by_year: PercentileByYear[] | null
  mc_calculated_at: string | null
  engine_version: string | null
  assumption_hash: string | null
}

/**
 * Loads the latest precomputed Monte Carlo result for a scenario.
 * Returns null when no result exists or scenarioId is missing.
 * Used by: projections page, export mappers, Strategy tab.
 * Do not use for the manual Strategy tab Run button — that path
 * uses the edge function directly via MonteCarloPanel.
 */
export async function loadScenarioMonteCarlo(
  scenarioId: string,
  supabase: SupabaseClient,
): Promise<MonteCarloSummary | null> {
  if (!scenarioId?.trim()) return null

  const { data, error } = await supabase
    .from('monte_carlo_results')
    .select(
      'scenario_id, p10_estate, p50_estate, p90_estate, p10_tax, p50_tax, p90_tax, success_rate, median_net_to_heirs, fan_chart_data, percentiles_by_year, mc_calculated_at, engine_version, assumption_hash',
    )
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[loadScenarioMonteCarlo]', error.message)
    return null
  }

  if (!data) return null

  const percentilesRaw = data.percentiles_by_year
  const percentiles_by_year = Array.isArray(percentilesRaw)
    ? (percentilesRaw as PercentileByYear[])
    : null

  const fanChartRaw = data.fan_chart_data
  const fan_chart_data = Array.isArray(fanChartRaw)
    ? (fanChartRaw as FanChartDataPoint[])
    : []

  return {
    scenario_id: data.scenario_id,
    p10_estate: Number(data.p10_estate ?? 0),
    p50_estate: Number(data.p50_estate ?? 0),
    p90_estate: Number(data.p90_estate ?? 0),
    p10_tax: Number(data.p10_tax ?? 0),
    p50_tax: Number(data.p50_tax ?? 0),
    p90_tax: Number(data.p90_tax ?? 0),
    success_rate: Number(data.success_rate ?? 0),
    median_net_to_heirs: Number(data.median_net_to_heirs ?? 0),
    fan_chart_data,
    percentiles_by_year,
    mc_calculated_at: data.mc_calculated_at ?? null,
    engine_version: data.engine_version ?? null,
    assumption_hash: data.assumption_hash ?? null,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import {
  buildProjectionInputsHashPayload,
  computeProjectionInputsHash,
} from '@/lib/monte-carlo/computeProjectionInputsHash'
import {
  loadScenarioMonteCarlo,
  type MonteCarloSummary,
} from '@/lib/advisor/loadScenarioMonteCarlo'

export type MonteCarloLoadResult = {
  summary: MonteCarloSummary | null
  isStale: boolean
  isUpdating: boolean
}

/**
 * Load precomputed MC results and compare household projection_inputs_hash to current inputs.
 * On mismatch (or null hash), triggers background base-case + MC regen and serves stale cache.
 */
export async function loadScenarioMonteCarloWithStaleness(
  supabase: SupabaseClient,
  params: { householdId: string; scenarioId: string },
): Promise<MonteCarloLoadResult> {
  const { householdId, scenarioId } = params
  if (!scenarioId?.trim() || !householdId?.trim()) {
    return { summary: null, isStale: false, isUpdating: false }
  }

  const [householdRes, scenarioRes, lineItemsRes] = await Promise.all([
    supabase
      .from('households')
      .select(
        'projection_inputs_hash, state_primary, filing_status, has_spouse, person1_birth_year, person2_birth_year, person1_longevity_age, person2_longevity_age, person1_retirement_age, growth_rate_accumulation, base_case_scenario_id',
      )
      .eq('id', householdId)
      .single(),
    supabase
      .from('projection_scenarios')
      .select('outputs_s1_first')
      .eq('id', scenarioId)
      .single(),
    supabase
      .from('strategy_line_items')
      .select('strategy_source, source_role, consumer_accepted, is_active, consumer_rejected')
      .eq('household_id', householdId),
  ])

  const household = householdRes.data
  if (!household) {
    return { summary: null, isStale: true, isUpdating: false }
  }

  const outputs = (scenarioRes.data?.outputs_s1_first ?? []) as Array<{
    estate_incl_home?: number | null
  }>
  const grossEstate = Number(outputs[0]?.estate_incl_home ?? 0)
  const hasBypassTrust = deriveHasBypassTrustFromLineItems(
    lineItemsRes.data ?? [],
    'consumer_accepted',
  )

  const currentHash = await computeProjectionInputsHash(
    buildProjectionInputsHashPayload({
      grossEstate,
      state_primary: household.state_primary,
      filing_status: household.filing_status,
      has_spouse: household.has_spouse,
      person1_birth_year: household.person1_birth_year,
      person2_birth_year: household.person2_birth_year,
      person1_longevity_age: household.person1_longevity_age,
      person2_longevity_age: household.person2_longevity_age,
      person1_retirement_age: household.person1_retirement_age,
      growth_rate_accumulation: household.growth_rate_accumulation,
      hasBypassTrust,
      base_case_scenario_id: household.base_case_scenario_id ?? scenarioId,
    }),
  )

  const storedHash = (household.projection_inputs_hash as string | null | undefined) ?? null
  const isStale = storedHash == null || storedHash !== currentHash

  if (isStale) {
    const { triggerBackgroundBaseCaseAndRecompute } = await import(
      '@/lib/projections/triggerBackgroundBaseCase'
    )
    triggerBackgroundBaseCaseAndRecompute(householdId)
  }

  const summary = await loadScenarioMonteCarlo(scenarioId, supabase)
  return {
    summary,
    isStale,
    isUpdating: isStale && summary != null,
  }
}

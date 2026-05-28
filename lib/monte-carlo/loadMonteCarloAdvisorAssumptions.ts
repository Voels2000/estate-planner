import type { SupabaseClient } from '@supabase/supabase-js'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'

function mapAssumptions(row: Record<string, unknown>) {
  return {
    returnMeanPct: Number(row.return_mean_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.returnMeanPct),
    volatilityPct: Number(row.volatility_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.volatilityPct),
    withdrawalRatePct: Number(
      row.withdrawal_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.withdrawalRatePct,
    ),
    successThreshold: Number(
      row.success_threshold ?? MONTE_CARLO_SYSTEM_DEFAULTS.successThreshold,
    ),
    simulationCount: Number(
      row.simulation_count ?? MONTE_CARLO_SYSTEM_DEFAULTS.simulationCount,
    ),
    planningHorizonYr: Number(
      row.planning_horizon_yr ?? MONTE_CARLO_SYSTEM_DEFAULTS.planningHorizonYr,
    ),
    inflationRatePct: Number(
      row.inflation_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.inflationRatePct,
    ),
  }
}

export type MonteCarloAdvisorAssumptionsPayload = {
  acceptedScenario: {
    id: string
    scenarioName: string | null
    acceptedAt: string | null
    assumptions: ReturnType<typeof mapAssumptions>
  } | null
  latestSharedScenario: {
    id: string
    scenarioName: string | null
    sharedAt: string | null
    assumptions: ReturnType<typeof mapAssumptions>
  } | null
  systemDefaults: typeof MONTE_CARLO_SYSTEM_DEFAULTS
}

export async function loadMonteCarloAdvisorAssumptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<MonteCarloAdvisorAssumptionsPayload> {
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .single()
  if (!household) {
    return {
      acceptedScenario: null,
      latestSharedScenario: null,
      systemDefaults: MONTE_CARLO_SYSTEM_DEFAULTS,
    }
  }

  const { data: acceptedRow } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('client_household_id', household.id)
    .eq('accepted_by_client', true)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: sharedRow } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('client_household_id', household.id)
    .not('shared_at', 'is', null)
    .order('shared_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    acceptedScenario: acceptedRow
      ? {
          id: acceptedRow.id,
          scenarioName: acceptedRow.scenario_name,
          acceptedAt: acceptedRow.accepted_at,
          assumptions: mapAssumptions(acceptedRow as Record<string, unknown>),
        }
      : null,
    latestSharedScenario: sharedRow
      ? {
          id: sharedRow.id,
          scenarioName: sharedRow.scenario_name,
          sharedAt: sharedRow.shared_at,
          assumptions: mapAssumptions(sharedRow as Record<string, unknown>),
        }
      : null,
    systemDefaults: MONTE_CARLO_SYSTEM_DEFAULTS,
  }
}

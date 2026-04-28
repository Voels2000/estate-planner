import { createClient } from '@/lib/supabase/server'
import { MONTE_CARLO_SYSTEM_DEFAULTS, type MonteCarloAssumptions } from './monteCarlo'

function mergeAssumptions(row: Record<string, unknown>): MonteCarloAssumptions {
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

export async function loadAdvisorAssumptions(
  advisorId: string,
  clientHouseholdId: string,
): Promise<{
  assumptions: MonteCarloAssumptions
  hasOverride: boolean
  scenarioName: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('advisor_id', advisorId)
    .eq('client_household_id', clientHouseholdId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    return {
      assumptions: { ...MONTE_CARLO_SYSTEM_DEFAULTS },
      hasOverride: false,
      scenarioName: null,
    }
  }

  const assumptions = mergeAssumptions(data as unknown as Record<string, unknown>)
  const hasOverride = Object.entries(assumptions).some(
    ([key, value]) => value !== MONTE_CARLO_SYSTEM_DEFAULTS[key as keyof MonteCarloAssumptions],
  )

  return {
    assumptions,
    hasOverride,
    scenarioName: (data.scenario_name as string | null) ?? null,
  }
}

export async function loadConsumerAcceptedAssumptions(
  clientHouseholdId: string,
): Promise<{
  assumptions: MonteCarloAssumptions
  hasAccepted: boolean
  scenarioName: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('client_household_id', clientHouseholdId)
    .eq('accepted_by_client', true)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return {
      assumptions: { ...MONTE_CARLO_SYSTEM_DEFAULTS },
      hasAccepted: false,
      scenarioName: null,
    }
  }

  return {
    assumptions: mergeAssumptions(data as unknown as Record<string, unknown>),
    hasAccepted: true,
    scenarioName: (data.scenario_name as string | null) ?? null,
  }
}

import {
  MONTE_CARLO_SYSTEM_DEFAULTS,
  type MonteCarloAssumptions,
} from '@/lib/calculations/monteCarlo'

type AssumptionRow = {
  return_mean_pct?: number | null
  volatility_pct?: number | null
  withdrawal_rate_pct?: number | null
  success_threshold?: number | null
  simulation_count?: number | null
  planning_horizon_yr?: number | null
  inflation_rate_pct?: number | null
}

/** Map DB row to engine assumptions; null columns fall back to system defaults. */
export function monteCarloAssumptionsFromRow(row: AssumptionRow | null): MonteCarloAssumptions {
  if (!row) return { ...MONTE_CARLO_SYSTEM_DEFAULTS }
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

import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'

export type ConsumerMCAssumptionSet = {
  returnMeanPct: number
  volatilityPct: number
  withdrawalRatePct: number
  successThreshold: number
  simulationCount: number
  planningHorizonYr: number
  inflationRatePct: number
}

export type ConsumerMCScenario = {
  id: string
  scenarioName: string
  assumptions: ConsumerMCAssumptionSet
  acceptedAt?: string
  sharedAt?: string
}

type MCRow = Record<string, unknown> & {
  id: string
  scenario_name?: string | null
  shared_at?: string | null
  accepted_by_client?: boolean | null
  accepted_at?: string | null
}

export function mapMCAssumptions(row: Record<string, unknown>): ConsumerMCAssumptionSet {
  return {
    returnMeanPct: Number(row.return_mean_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.returnMeanPct),
    volatilityPct: Number(row.volatility_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.volatilityPct),
    withdrawalRatePct: Number(row.withdrawal_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.withdrawalRatePct),
    successThreshold: Number(row.success_threshold ?? MONTE_CARLO_SYSTEM_DEFAULTS.successThreshold),
    simulationCount: Number(row.simulation_count ?? MONTE_CARLO_SYSTEM_DEFAULTS.simulationCount),
    planningHorizonYr: Number(row.planning_horizon_yr ?? MONTE_CARLO_SYSTEM_DEFAULTS.planningHorizonYr),
    inflationRatePct: Number(row.inflation_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.inflationRatePct),
  }
}

export function buildConsumerMCScenariosFromRows(rows: MCRow[] | null | undefined): {
  acceptedMCScenario: ConsumerMCScenario | null
  latestSharedMCScenario: ConsumerMCScenario | null
} {
  const mcRows = rows ?? []
  const acceptedMCRow = mcRows.find((r) => r.accepted_by_client === true) ?? null
  const sharedMCRow =
    mcRows.find((r) => r.shared_at != null && !r.accepted_by_client) ?? null

  const acceptedMCScenario = acceptedMCRow
    ? {
        id: String(acceptedMCRow.id),
        scenarioName: String(acceptedMCRow.scenario_name ?? 'Advisor Scenario'),
        acceptedAt: String(acceptedMCRow.accepted_at),
        assumptions: mapMCAssumptions(acceptedMCRow),
      }
    : null

  const latestSharedMCScenario = sharedMCRow
    ? {
        id: String(sharedMCRow.id),
        scenarioName: String(sharedMCRow.scenario_name ?? 'Advisor Scenario'),
        sharedAt: String(sharedMCRow.shared_at),
        assumptions: mapMCAssumptions(sharedMCRow),
      }
    : null

  return { acceptedMCScenario, latestSharedMCScenario }
}

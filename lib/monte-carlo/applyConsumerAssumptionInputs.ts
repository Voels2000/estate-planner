import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'
import type { MonteCarloInputs } from '@/lib/monte-carlo'
import type { ConsumerMCAssumptionSet } from '@/lib/monte-carlo/consumerAssumptionScenarios'

export type ConsumerMCAssumptionFieldDef = {
  key: keyof ConsumerMCAssumptionSet
  label: string
  min: number
  max: number
  step: number
  suffix?: string
  hint?: string
}

export const CONSUMER_MC_ASSUMPTION_FIELDS: ConsumerMCAssumptionFieldDef[] = [
  {
    key: 'returnMeanPct',
    label: 'Expected annual return',
    min: 2,
    max: 12,
    step: 0.25,
    suffix: '%',
    hint: 'Overrides portfolio return model when advisor assumptions are applied.',
  },
  {
    key: 'volatilityPct',
    label: 'Annual volatility',
    min: 5,
    max: 25,
    step: 0.5,
    suffix: '%',
  },
  {
    key: 'withdrawalRatePct',
    label: 'Target withdrawal rate',
    min: 1,
    max: 8,
    step: 0.25,
    suffix: '%',
    hint: 'Reference rate — compare to your safe withdrawal result on the review step.',
  },
  {
    key: 'successThreshold',
    label: 'Success goal',
    min: 50,
    max: 99,
    step: 1,
    suffix: '%',
    hint: 'Share of simulations that should reach your spending target.',
  },
  {
    key: 'simulationCount',
    label: 'Simulation runs',
    min: 500,
    max: 10000,
    step: 500,
  },
  {
    key: 'planningHorizonYr',
    label: 'Planning horizon',
    min: 10,
    max: 50,
    step: 1,
    suffix: ' yrs',
  },
  {
    key: 'inflationRatePct',
    label: 'Inflation assumption',
    min: 1,
    max: 6,
    step: 0.25,
    suffix: '%',
  },
]

export function defaultConsumerMCAssumptions(): ConsumerMCAssumptionSet {
  return { ...MONTE_CARLO_SYSTEM_DEFAULTS }
}

export function applyConsumerMCAssumptionsToInputs(
  inputs: MonteCarloInputs,
  assumptions: ConsumerMCAssumptionSet | null | undefined,
): MonteCarloInputs {
  if (!assumptions) return inputs

  const planningEndAge =
    inputs.current_age > 0 ? inputs.current_age + assumptions.planningHorizonYr : inputs.life_expectancy
  const p2PlanningEndAge =
    inputs.has_spouse && inputs.p2_current_age > 0
      ? inputs.p2_current_age + assumptions.planningHorizonYr
      : inputs.p2_life_expectancy

  return {
    ...inputs,
    inflation_rate: assumptions.inflationRatePct,
    simulation_count: assumptions.simulationCount,
    portfolio_return_mean_pct: assumptions.returnMeanPct,
    portfolio_return_volatility_pct: assumptions.volatilityPct,
    mc_success_threshold_pct: assumptions.successThreshold,
    mc_withdrawal_rate_pct: assumptions.withdrawalRatePct,
    life_expectancy: Math.max(inputs.life_expectancy, planningEndAge),
    p2_life_expectancy: inputs.has_spouse
      ? Math.max(inputs.p2_life_expectancy, p2PlanningEndAge)
      : inputs.p2_life_expectancy,
  }
}

export function assumptionsFromInputs(inputs: MonteCarloInputs): ConsumerMCAssumptionSet {
  const d = defaultConsumerMCAssumptions()
  return {
    returnMeanPct: inputs.portfolio_return_mean_pct ?? d.returnMeanPct,
    volatilityPct: inputs.portfolio_return_volatility_pct ?? d.volatilityPct,
    withdrawalRatePct: inputs.mc_withdrawal_rate_pct ?? d.withdrawalRatePct,
    successThreshold: inputs.mc_success_threshold_pct ?? d.successThreshold,
    simulationCount: inputs.simulation_count ?? d.simulationCount,
    planningHorizonYr:
      inputs.current_age > 0
        ? Math.max(10, inputs.life_expectancy - inputs.current_age)
        : d.planningHorizonYr,
    inflationRatePct: inputs.inflation_rate ?? d.inflationRatePct,
  }
}

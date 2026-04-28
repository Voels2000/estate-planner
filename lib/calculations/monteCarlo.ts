export type MonteCarloAssumptions = {
  returnMeanPct: number
  volatilityPct: number
  withdrawalRatePct: number
  successThreshold: number
  simulationCount: number
  planningHorizonYr: number
  inflationRatePct: number
}

// These values are used when no advisor override exists.
export const MONTE_CARLO_SYSTEM_DEFAULTS: MonteCarloAssumptions = {
  returnMeanPct: 6.5,
  volatilityPct: 12.0,
  withdrawalRatePct: 4.0,
  successThreshold: 85.0,
  simulationCount: 1000,
  planningHorizonYr: 30,
  inflationRatePct: 2.5,
}

export type MonteCarloInput = {
  portfolioValue: number
  annualSpend: number
  annualIncome?: number
}

export type MonteCarloResult = {
  successRate: number
  medianEndingValue: number
  p10EndingValue: number
  p50EndingValue: number
  p90EndingValue: number
  simulationCount: number
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + stdDev * n
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

export function runMonteCarloSimulation(
  input: MonteCarloInput,
  assumptions: MonteCarloAssumptions = MONTE_CARLO_SYSTEM_DEFAULTS,
): MonteCarloResult {
  const returnMean = assumptions.returnMeanPct / 100
  const volatility = assumptions.volatilityPct / 100
  const withdrawalRate = assumptions.withdrawalRatePct / 100
  const horizon = assumptions.planningHorizonYr
  const simCount = assumptions.simulationCount
  const inflation = assumptions.inflationRatePct / 100

  const initialPortfolio = Math.max(0, Number(input.portfolioValue ?? 0))
  const annualSpend = Math.max(0, Number(input.annualSpend ?? 0))
  const annualIncome = Math.max(0, Number(input.annualIncome ?? 0))
  const annualNetWithdrawalBase = Math.max(
    annualSpend - annualIncome,
    initialPortfolio * withdrawalRate,
  )

  const endingValues: number[] = []
  let successCount = 0

  for (let i = 0; i < simCount; i++) {
    let balance = initialPortfolio
    for (let year = 0; year < horizon; year++) {
      const annualReturn = randomNormal(returnMean, volatility)
      balance = Math.max(0, balance * (1 + annualReturn))
      const withdrawal = annualNetWithdrawalBase * Math.pow(1 + inflation, year)
      balance = Math.max(0, balance - withdrawal)
      if (balance <= 0) break
    }
    if (balance > 0) successCount += 1
    endingValues.push(balance)
  }

  const sorted = [...endingValues].sort((a, b) => a - b)
  return {
    successRate: simCount > 0 ? Math.round((successCount / simCount) * 100) : 0,
    medianEndingValue: Math.round(percentile(sorted, 50)),
    p10EndingValue: Math.round(percentile(sorted, 10)),
    p50EndingValue: Math.round(percentile(sorted, 50)),
    p90EndingValue: Math.round(percentile(sorted, 90)),
    simulationCount: simCount,
  }
}

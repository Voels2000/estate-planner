import { formatCurrency } from '@/lib/insurance'

export interface MonteCarloInputs {
  current_age: number
  retirement_age: number
  life_expectancy: number
  current_portfolio: number
  monthly_contribution: number
  stocks_pct: number
  bonds_pct: number
  cash_pct: number
  annual_spending: number
  social_security_monthly: number
  social_security_start_age: number
  other_income_annual: number
  inflation_rate: number
  simulation_count: number
  include_rmd: boolean
}

export interface YearlyDataPoint {
  age: number
  balance: number
}

export interface MonteCarloResult {
  success_rate: number
  safe_withdrawal_rate: number
  median_balance: number
  worst_case_balance: number
  best_case_balance: number
  percentile_10: YearlyDataPoint[]
  percentile_25: YearlyDataPoint[]
  percentile_50: YearlyDataPoint[]
  percentile_75: YearlyDataPoint[]
  percentile_90: YearlyDataPoint[]
  insight: string
  insight_boost: string
}

const ASSET_ASSUMPTIONS = {
  stocks: { mean: 0.10, stdDev: 0.17 },
  bonds:  { mean: 0.04, stdDev: 0.06 },
  cash:   { mean: 0.02, stdDev: 0.01 },
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + stdDev * n
}

function portfolioReturn(stocks: number, bonds: number, cash: number): number {
  const s = stocks / 100
  const b = bonds / 100
  const c = cash / 100
  return (
    randomNormal(ASSET_ASSUMPTIONS.stocks.mean, ASSET_ASSUMPTIONS.stocks.stdDev) * s +
    randomNormal(ASSET_ASSUMPTIONS.bonds.mean, ASSET_ASSUMPTIONS.bonds.stdDev) * b +
    randomNormal(ASSET_ASSUMPTIONS.cash.mean, ASSET_ASSUMPTIONS.cash.stdDev) * c
  )
}

function getRMDDivisor(age: number): number {
  const table: Record<number, number> = {
    73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
    83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
    93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  }
  return table[Math.min(age, 97)] ?? 7.8
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

export function runSimulation(inputs: MonteCarloInputs): MonteCarloResult {
  const {
    current_age, retirement_age, life_expectancy,
    current_portfolio, monthly_contribution,
    stocks_pct, bonds_pct, cash_pct,
    annual_spending, social_security_monthly, social_security_start_age,
    other_income_annual, inflation_rate, simulation_count, include_rmd,
  } = inputs

  const yearsToRetirement = Math.max(0, retirement_age - current_age)
  const yearsInRetirement = Math.max(0, life_expectancy - retirement_age)
  const totalYears = yearsToRetirement + yearsInRetirement
  const inflationFactor = inflation_rate / 100
  const annualContribution = monthly_contribution * 12

  const finalBalances: number[] = []
  const yearlyPaths: number[][] = Array.from({ length: totalYears + 1 }, () => [])

  for (let sim = 0; sim < simulation_count; sim++) {
    let balance = current_portfolio
    for (let year = 0; year <= totalYears; year++) {
      const age = current_age + year
      const isRetired = age >= retirement_age
      const ret = portfolioReturn(stocks_pct, bonds_pct, cash_pct)
      if (!isRetired) {
        balance = balance * (1 + ret) + annualContribution
      } else {
        const inflationMultiplier = Math.pow(1 + inflationFactor, age - retirement_age)
        const inflatedSpending = annual_spending * inflationMultiplier
        const ssIncome = age >= social_security_start_age ? social_security_monthly * 12 : 0
        const totalIncome = ssIncome + other_income_annual
        let withdrawal = Math.max(0, inflatedSpending - totalIncome)
        if (include_rmd && age >= 73) {
          const rmd = balance / getRMDDivisor(age)
          withdrawal = Math.max(withdrawal, rmd)
        }
        balance = Math.max(0, balance * (1 + ret) - withdrawal)
      }
      yearlyPaths[year].push(balance)
    }
    finalBalances.push(balance)
  }

  const successCount = finalBalances.filter(b => b > 0).length
  const success_rate = Math.round((successCount / simulation_count) * 100)
  const sortedPaths = yearlyPaths.map(arr => [...arr].sort((a, b) => a - b))

  const buildPath = (p: number): YearlyDataPoint[] =>
    sortedPaths.map((arr, i) => ({
      age: current_age + i,
      balance: Math.round(percentile(arr, p)),
    }))

  const p10 = buildPath(10)
  const p25 = buildPath(25)
  const p50 = buildPath(50)
  const p75 = buildPath(75)
  const p90 = buildPath(90)

  const median_balance = p50[p50.length - 1]?.balance ?? 0
  const worst_case_balance = p10[p10.length - 1]?.balance ?? 0
  const best_case_balance = p90[p90.length - 1]?.balance ?? 0

  const retirementPortfolio = p50[yearsToRetirement]?.balance ?? current_portfolio
  const safe_withdrawal_rate = retirementPortfolio > 0
    ? Math.round(((annual_spending / retirementPortfolio) * 100) * 10) / 10
    : 0

  const boostedFinals = runSimulationRaw({ ...inputs, monthly_contribution: monthly_contribution + 500, simulation_count: 1000 })
  const boostedSuccess = Math.round((boostedFinals.filter(b => b > 0).length / 1000) * 100)

  const insight = success_rate >= 90
    ? `Excellent outlook. Your plan succeeds in ${success_rate}% of simulations.`
    : success_rate >= 75
    ? `Good outlook. Your plan succeeds in ${success_rate}% of simulations. Minor adjustments could push you above 90%.`
    : success_rate >= 60
    ? `Moderate risk. Your plan succeeds in ${success_rate}% of simulations. Consider increasing contributions or adjusting spending.`
    : `High risk. Your plan only succeeds in ${success_rate}% of simulations. Significant changes are recommended.`

  const insight_boost = success_rate < 90
    ? `Increasing monthly contributions by $500 raises your success rate from ${success_rate}% to ${boostedSuccess}%.`
    : `Your current plan is on track. Maintaining your contribution rate keeps you in the top tier of retirement readiness.`

  return {
    success_rate, safe_withdrawal_rate,
    median_balance, worst_case_balance, best_case_balance,
    percentile_10: p10, percentile_25: p25, percentile_50: p50,
    percentile_75: p75, percentile_90: p90,
    insight, insight_boost,
  }
}

function runSimulationRaw(inputs: MonteCarloInputs): number[] {
  const {
    current_age, retirement_age, life_expectancy,
    current_portfolio, monthly_contribution,
    stocks_pct, bonds_pct, cash_pct,
    annual_spending, social_security_monthly, social_security_start_age,
    other_income_annual, inflation_rate, simulation_count, include_rmd,
  } = inputs

  const yearsToRetirement = Math.max(0, retirement_age - current_age)
  const yearsInRetirement = Math.max(0, life_expectancy - retirement_age)
  const totalYears = yearsToRetirement + yearsInRetirement
  const inflationFactor = inflation_rate / 100
  const annualContribution = monthly_contribution * 12
  const finalBalances: number[] = []

  for (let sim = 0; sim < simulation_count; sim++) {
    let balance = current_portfolio
    for (let year = 0; year <= totalYears; year++) {
      const age = current_age + year
      const isRetired = age >= retirement_age
      const ret = portfolioReturn(stocks_pct, bonds_pct, cash_pct)
      if (!isRetired) {
        balance = balance * (1 + ret) + annualContribution
      } else {
        const inflationMultiplier = Math.pow(1 + inflationFactor, age - retirement_age)
        const inflatedSpending = annual_spending * inflationMultiplier
        const ssIncome = age >= social_security_start_age ? social_security_monthly * 12 : 0
        const totalIncome = ssIncome + other_income_annual
        let withdrawal = Math.max(0, inflatedSpending - totalIncome)
        if (include_rmd && age >= 73) {
          const rmd = balance / getRMDDivisor(age)
          withdrawal = Math.max(withdrawal, rmd)
        }
        balance = Math.max(0, balance * (1 + ret) - withdrawal)
      }
    }
    finalBalances.push(balance)
  }
  return finalBalances
}

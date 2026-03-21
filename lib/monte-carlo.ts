import { formatCurrency } from '@/lib/insurance'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MonteCarloInputs {
  // Person 1
  current_age: number
  retirement_age: number
  life_expectancy: number
  birth_year: number

  // Person 2 (optional)
  has_spouse: boolean
  p2_current_age: number
  p2_retirement_age: number
  p2_life_expectancy: number
  p2_birth_year: number

  // Portfolio
  current_portfolio: number
  monthly_contribution: number
  stocks_pct: number
  bonds_pct: number
  cash_pct: number

  // Retirement Spending
  annual_spending: number
  survivor_spending_pct: number

  // Person 1 SS
  social_security_monthly: number
  social_security_start_age: number

  // Person 2 SS
  p2_social_security_monthly: number
  p2_social_security_start_age: number

  // Other income
  other_income_annual: number

  // Spending schedule (optional — overrides flat spending in specific years)
  spending_schedule?: { age: number; amount: number }[]

  // Assumptions
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
  plan_end_age: number
  is_joint: boolean
}

// ── Asset Class Assumptions ───────────────────────────────────────────────────

const ASSET_ASSUMPTIONS = {
  stocks: { mean: 0.10, stdDev: 0.17 },
  bonds:  { mean: 0.04, stdDev: 0.06 },
  cash:   { mean: 0.02, stdDev: 0.01 },
}

// ── Math Helpers ──────────────────────────────────────────────────────────────

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

// SECURE 2.0: RMD age is 73 if born before 1960, 75 if born 1960 or later
function getRMDStartAge(birthYear: number): number {
  return birthYear >= 1960 ? 75 : 73
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

// ── Core Simulation ───────────────────────────────────────────────────────────

export function runSimulation(inputs: MonteCarloInputs): MonteCarloResult {
  const {
    current_age, retirement_age, life_expectancy, birth_year,
    has_spouse, p2_current_age, p2_retirement_age, p2_life_expectancy, p2_birth_year,
    current_portfolio, monthly_contribution,
    stocks_pct, bonds_pct, cash_pct,
    annual_spending, survivor_spending_pct,
    social_security_monthly, social_security_start_age,
    p2_social_security_monthly, p2_social_security_start_age,
    other_income_annual, inflation_rate, simulation_count, include_rmd,
  } = inputs

  // Plan runs until the last survivor
  const p1RmdStart = getRMDStartAge(birth_year)
  const p2RmdStart = has_spouse ? getRMDStartAge(p2_birth_year) : 999

  // Age offset between Person 1 and Person 2
  const ageDiff = has_spouse ? current_age - p2_current_age : 0

  // Total years = from now until last survivor dies
  const p1End = life_expectancy
  const p2End = has_spouse ? p2_life_expectancy + ageDiff : 0
  const planEndAge = Math.max(p1End, p2End)
  const totalYears = Math.max(0, planEndAge - current_age)

  const inflationFactor = inflation_rate / 100
  const annualContribution = monthly_contribution * 12

  const finalBalances: number[] = []
  const yearlyPaths: number[][] = Array.from({ length: totalYears + 1 }, () => [])

  for (let sim = 0; sim < simulation_count; sim++) {
    let balance = current_portfolio

    for (let year = 0; year <= totalYears; year++) {
      const p1Age = current_age + year
      const p2Age = has_spouse ? p2_current_age + year : 0

      const p1Alive = p1Age <= life_expectancy
      const p2Alive = has_spouse ? p2Age <= p2_life_expectancy : false
      const bothAlive = p1Alive && p2Alive

      const p1Retired = p1Age >= retirement_age
      const p2Retired = has_spouse ? p2Age >= p2_retirement_age : true
      const bothRetired = p1Retired && p2Retired

      const ret = portfolioReturn(stocks_pct, bonds_pct, cash_pct)

      if (!p1Retired && !p2Retired) {
        // Full accumulation phase
        balance = balance * (1 + ret) + annualContribution
      } else if (!bothRetired) {
        // Partial — one still working, reduced contribution
        balance = balance * (1 + ret) + (annualContribution * 0.5)
      } else {
        // Full distribution phase
        const inflationMultiplier = Math.pow(1 + inflationFactor, year)

        // Spending schedule: find the most recent step at or before current age
        const scheduleEntry = inputs.spending_schedule
          ?.filter(s => p1Age >= s.age)
          .sort((a, b) => b.age - a.age)[0]
        const baseSpending = scheduleEntry ? scheduleEntry.amount : annual_spending

        // Spending adjusts down if only one spouse alive
        const spendingMultiplier = (!has_spouse || bothAlive) ? 1.0 : (survivor_spending_pct / 100)
        const inflatedSpending = baseSpending * inflationMultiplier * spendingMultiplier

        // Person 1 SS
        const p1SS = p1Alive && p1Age >= social_security_start_age
          ? social_security_monthly * 12
          : 0

        // Person 2 SS
        const p2SS = p2Alive && p2Age >= p2_social_security_start_age
          ? p2_social_security_monthly * 12
          : 0

        // Survivor SS — at first death, survivor gets higher of the two benefits
        let survivorSS = 0
        if (has_spouse) {
          if (!p1Alive && p2Alive) {
        survivorSS = Math.max(social_security_monthly, p2_social_security_monthly) * 12
          } else if (p1Alive && !p2Alive) {
            survivorSS = Math.max(social_security_monthly, p2_social_security_monthly) * 12
          }
        }

        const totalSS = bothAlive ? p1SS + p2SS : survivorSS
        const totalIncome = totalSS + other_income_annual
        let withdrawal = Math.max(0, inflatedSpending - totalIncome)

        // RMD — Person 1
        if (include_rmd && p1Alive && p1Age >= p1RmdStart) {
          const rmd = balance / getRMDDivisor(p1Age)
          withdrawal = Math.max(withdrawal, rmd)
        }

        // RMD — Person 2 (uses p1Age for portfolio tracking since it's joint)
        if (include_rmd && p2Alive && p2Age >= p2RmdStart) {
          const rmd2 = balance / getRMDDivisor(p2Age)
          withdrawal = Math.max(withdrawal, rmd2)
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

  const yearsToRetirement = Math.max(0, retirement_age - current_age)
  const retirementPortfolio = p50[yearsToRetirement]?.balance ?? current_portfolio
  const safe_withdrawal_rate = retirementPortfolio > 0
    ? Math.round(((annual_spending / retirementPortfolio) * 100) * 10) / 10
    : 0

  const boostedFinals = runSimulationRaw({ ...inputs, monthly_contribution: monthly_contribution + 500, simulation_count: 1000 })
  const boostedSuccess = Math.round((boostedFinals.filter(b => b > 0).length / 1000) * 100)

  const planLabel = has_spouse ? 'joint plan' : 'plan'

  const insight = success_rate >= 90
    ? `Excellent outlook. Your ${planLabel} succeeds in ${success_rate}% of simulations — you are well-positioned for retirement.`
    : success_rate >= 75
    ? `Good outlook. Your ${planLabel} succeeds in ${success_rate}% of simulations. Minor adjustments could push you above 90%.`
    : success_rate >= 60
    ? `Moderate risk. Your ${planLabel} succeeds in ${success_rate}% of simulations. Consider increasing contributions or adjusting spending.`
    : `High risk. Your ${planLabel} only succeeds in ${success_rate}% of simulations. Significant changes are recommended.`

  const insight_boost = success_rate < 90
    ? `Increasing monthly contributions by ${formatCurrency(500)} raises your suess rate from ${success_rate}% to ${boostedSuccess}%.`
    : `Your current plan is on track. Maintaining your contribution rate keeps you in the top tier of retirement readiness.`

  return {
    success_rate, safe_withdrawal_rate,
    median_balance, worst_case_balance, best_case_balance,
    percentile_10: p10, percentile_25: p25, percentile_50: p50,
    percentile_75: p75, percentile_90: p90,
    insight, insight_boost,
    plan_end_age: planEndAge,
    is_joint: has_spouse,
  }
}

function runSimulationRaw(inputs: MonteCarloInputs): number[] {
  const {
    current_age, retirement_age, life_expectancy, birth_year,
    has_spouse, p2_current_age, p2_retirement_age, p2_life_expectancy, p2_birth_year,
    current_portfolio, monthly_contribution,
    stocks_pct, bonds_pct, cash_pct,
    annual_spending, survivor_spending_pct,
    social_security_monthly, social_security_start_age,
    p2_social_security_monthly, p2_social_security_start_age,
    other_income_annual, inflation_rate, simulation_count, include_rmd,
  } = inputs

  const p1RmdStart = getRMDStartAge(birth_year)
  const p2RmdStart = has_spouse ? getRMDStartAge(p2_birth_year) : 999
  const ageDiff = has_spouse ? current_age - p2_current_age : 0
  const p2End = has_spouse ? p2_life_expectancy + ageDiff : 0
  const planEndAge = Math.max(life_expectancy, p2End)
  const totalYears = Math.max(0, planEndAge - current_age)
  const inflationFactor = inflation_rate / 100
  const annualContribution = monthly_contribution * 12
  const finalBalances: number[] = []

  for (let sim = 0; sim < simulation_count; sim++) {
    let balance = current_portfolio
    for (let year = 0; year <= totalYears; year++) {
      const p1Age = current_age + year
      const p2Age = has_spouse ? p2_current_age + year : 0
      const p1Alive = p1Age <= life_expectancy
      const p2Alive = has_spouse ? p2Age <= p2_life_expectancy : false
      const bothAlive = p1Alive && p2Alive
      const p1Retired = p1Age >= retirement_age
      const p2Retired = has_spouse ? p2Age >= p2_retirement_age : true
      const bothRetired = p1Retired && p2Retired
      const ret = portfolioReturn(stocks_pct, bonds_pct, cash_pct)

      if (!p1Retired && !p2Retired) {
        balance = balance * (1 + ret) + annualContribution
      } else if (!bothRetired) {
        balance = balance * (1 + ret) + (annualContribution * 0.5)
      } else {
        const inflationMultiplier = Math.pow(1 + inflationFactor, year)
        const spendingMultiplier = (!has_spouse || bothAlive) ? 1.0 : (survivor_spending_pct / 100)
        const inflatedSpending = annual_spending * inflationMultiplier * spendingMultiplier
        const p1SS = p1Alive && p1Age >= social_security_start_age ? social_security_monthly * 12 : 0
        const p2SS = p2Alive && p2Age >= p2_social_security_start_age ? p2_social_security_monthly * 12 : 0
        let survivorSS = 0
        if (has_spouse) {
          if (!p1Alive || !p2Alive) {
            survivorSS = Math.max(social_security_monthly, p2_social_security_monthly) * 12
          }
        }
        const totalSS = bothAlive ? p1SS + p2SS : survivorSS
        const totalIncome = totalSS + other_income_annual
        let withdrawal = Math.max(0, inflatedSpending - totalIncome)
        if (include_rmd && p1Alive && p1Age >= p1RmdStart) {
          withdrawal = Math.max(withdrawal, balance / getRMDDivisor(p1Age))
        }
        if (include_rmd && p2Alive && p2Age >= p2RmdStart) {
          withdrawal = Math.max(withdrawal, balance / getRMDDivisor(p2Age))
        }
        balance = Math.max(0, balance * (1 + ret) - withdrawal)
      }
    }
    finalBalances.push(balance)
  }
  return finalBalances
}

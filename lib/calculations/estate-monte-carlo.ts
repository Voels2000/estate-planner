// Sprint 71 — Estate Monte Carlo Engine
//
// Runs N simulations of estate value at death across randomized market return scenarios.
// Each path applies stochastic returns to the gross estate and computes estate tax
// under the selected law scenario.
//
// Designed to run inside a Supabase Edge Function (60s limit) not Vercel (10s limit).
// 500 paths is statistically sufficient for P10/P50/P90 fan charts.
//
// Key difference from consumer Monte Carlo (lib/calculations/monte-carlo.ts):
//   Consumer: retirement portfolio sustainability (will money last?)
//   Estate:   estate tax burden range (how much will heirs owe across scenarios?)

export interface EstateMCInputs {
  // Current estate (year-1 from outputs_s1_first[0])
  grossEstate: number
  // Federal exemption under selected law scenario
  federalExemption: number
  // State estate tax rate (flat approximation)
  stateEstateTaxRate: number
  // Years until projected death (for growth projection)
  yearsUntilDeath: number
  // Asset growth rate assumption (from household growth_rate_accumulation)
  baseGrowthRate: number
  // Strategy reductions already applied (from CompositeOverlay)
  strategyEstatereduction: number
  // Law scenario
  lawScenario: 'current_law' | 'no_exemption'
  // Number of simulation paths
  simulationCount: number
  // Whether to include sensitivity analysis
  includeSensitivity: boolean
}

export interface FanChartDataPoint {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface SensitivityResult {
  variable: string
  low_value: number
  low_tax: number
  base_tax: number
  high_value: number
  high_tax: number
}

export interface EstateMCResult {
  // Percentile estate values at death
  p10_estate: number
  p25_estate: number
  p50_estate: number
  p75_estate: number
  p90_estate: number
  // Percentile tax amounts at death
  p10_tax: number
  p50_tax: number
  p90_tax: number
  // Success rate: % of paths where estate tax = $0 (below exemption)
  success_rate: number
  // Median net to heirs
  median_net_to_heirs: number
  // Year-by-year fan chart data
  fan_chart_data: FanChartDataPoint[]
  // Sensitivity matrix (growth rate × exemption)
  sensitivity_matrix: SensitivityResult[]
  // Runtime
  run_duration_ms: number
}

// Asset class return assumptions (matching consumer Monte Carlo)
const RETURN_ASSUMPTIONS = {
  mean: 0.07, // 7% blended mean (60/40 portfolio approximation)
  stdDev: 0.12, // 12% standard deviation
}

// Box-Muller transform for normal distribution
function randomNormal(mean: number, stdDev: number): number {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + stdDev * n
}

function calcEstateTax(
  estate: number,
  exemption: number,
  stateRate: number,
  lawScenario: 'current_law' | 'no_exemption'
): number {
  const FEDERAL_RATE = 0.4
  const effectiveExemption =
    lawScenario === 'no_exemption' ? 0 : exemption

  const federalTax = Math.max(0, estate - effectiveExemption) * FEDERAL_RATE
  const stateTax = estate * stateRate
  return federalTax + stateTax
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

export function runEstateMonteCarlo(inputs: EstateMCInputs): EstateMCResult {
  const {
    grossEstate,
    federalExemption,
    stateEstateTaxRate,
    yearsUntilDeath,
    baseGrowthRate,
    strategyEstatereduction,
    lawScenario,
    simulationCount,
    includeSensitivity,
  } = inputs

  const startTime = Date.now()
  const adjustedEstate = Math.max(0, grossEstate - strategyEstatereduction)

  // Track final estate values and year-by-year paths
  const finalEstates: number[] = []
  const yearlyEstates: number[][] = Array.from({ length: yearsUntilDeath + 1 }, () => [])

  for (let sim = 0; sim < simulationCount; sim++) {
    let estate = adjustedEstate

    for (let year = 0; year <= yearsUntilDeath; year++) {
      const annualReturn = randomNormal(RETURN_ASSUMPTIONS.mean, RETURN_ASSUMPTIONS.stdDev)
      estate = Math.max(0, estate * (1 + annualReturn))
      yearlyEstates[year].push(estate)
    }

    finalEstates.push(estate)
  }

  // Sort final estates for percentile calculations
  const sortedFinals = [...finalEstates].sort((a, b) => a - b)

  const p10_estate = percentile(sortedFinals, 10)
  const p25_estate = percentile(sortedFinals, 25)
  const p50_estate = percentile(sortedFinals, 50)
  const p75_estate = percentile(sortedFinals, 75)
  const p90_estate = percentile(sortedFinals, 90)

  const p10_tax = calcEstateTax(p10_estate, federalExemption, stateEstateTaxRate, lawScenario)
  const p50_tax = calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate, lawScenario)
  const p90_tax = calcEstateTax(p90_estate, federalExemption, stateEstateTaxRate, lawScenario)

  // Success rate: paths where no estate tax is owed
  const successCount = sortedFinals.filter(
    (e) => calcEstateTax(e, federalExemption, stateEstateTaxRate, lawScenario) === 0
  ).length
  const success_rate = Math.round((successCount / simulationCount) * 100)

  const median_net_to_heirs = p50_estate - p50_tax

  // Fan chart: year-by-year percentiles
  const fan_chart_data: FanChartDataPoint[] = yearlyEstates.map((yearArr, i) => {
    const sorted = [...yearArr].sort((a, b) => a - b)
    return {
      year: new Date().getFullYear() + i,
      p10: Math.round(percentile(sorted, 10)),
      p25: Math.round(percentile(sorted, 25)),
      p50: Math.round(percentile(sorted, 50)),
      p75: Math.round(percentile(sorted, 75)),
      p90: Math.round(percentile(sorted, 90)),
    }
  })

  // Sensitivity matrix: 3×2 (growth rate × exemption)
  const sensitivity_matrix: SensitivityResult[] = []

  if (includeSensitivity) {
    // Growth rate sensitivity
    const growthScenarios = [{ label: 'Growth Rate', low: baseGrowthRate - 0.02, high: baseGrowthRate + 0.02 }]
    for (const scenario of growthScenarios) {
      const lowEstate = adjustedEstate * Math.pow(1 + scenario.low, yearsUntilDeath)
      const highEstate = adjustedEstate * Math.pow(1 + scenario.high, yearsUntilDeath)
      sensitivity_matrix.push({
        variable: scenario.label,
        low_value: scenario.low,
        low_tax: calcEstateTax(lowEstate, federalExemption, stateEstateTaxRate, lawScenario),
        base_tax: p50_tax,
        high_value: scenario.high,
        high_tax: calcEstateTax(highEstate, federalExemption, stateEstateTaxRate, lawScenario),
      })
    }

    // Exemption sensitivity (current law vs no-exemption stress)
    sensitivity_matrix.push({
      variable: 'Federal Exemption',
      low_value: 0,
      low_tax: calcEstateTax(p50_estate, 0, stateEstateTaxRate, 'no_exemption'),
      base_tax: p50_tax,
      high_value: federalExemption,
      high_tax: calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate, 'current_law'),
    })

    // State tax sensitivity
    sensitivity_matrix.push({
      variable: 'State Tax Rate',
      low_value: 0,
      low_tax: calcEstateTax(p50_estate, federalExemption, 0, lawScenario),
      base_tax: p50_tax,
      high_value: stateEstateTaxRate * 2,
      high_tax: calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate * 2, lawScenario),
    })
  }

  const run_duration_ms = Date.now() - startTime

  return {
    p10_estate: Math.round(p10_estate),
    p25_estate: Math.round(p25_estate),
    p50_estate: Math.round(p50_estate),
    p75_estate: Math.round(p75_estate),
    p90_estate: Math.round(p90_estate),
    p10_tax: Math.round(p10_tax),
    p50_tax: Math.round(p50_tax),
    p90_tax: Math.round(p90_tax),
    success_rate,
    median_net_to_heirs: Math.round(median_net_to_heirs),
    fan_chart_data,
    sensitivity_matrix,
    run_duration_ms,
  }
}

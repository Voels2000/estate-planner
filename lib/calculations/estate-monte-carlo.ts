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

import {
  calculateStateEstateTax,
  resolveActiveStateTax,
  type StateBracket,
} from './stateEstateTax'

export type { StateBracket }

export interface EstateMCInputs {
  grossEstate: number
  federalExemption: number
  stateCode: string
  stateBrackets: StateBracket[]
  filingStatus: 'single' | 'mfj'
  hasBypassTrust: boolean
  yearsUntilDeath: number
  baseGrowthRate: number
  strategyEstatereduction: number
  lawScenario: 'current_law' | 'no_exemption'
  simulationCount: number
  includeSensitivity: boolean
  returnMeanPct?: number
  volatilityPct?: number
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
  p10_estate: number
  p25_estate: number
  p50_estate: number
  p75_estate: number
  p90_estate: number
  p10_tax: number
  p50_tax: number
  p90_tax: number
  success_rate: number
  median_net_to_heirs: number
  fan_chart_data: FanChartDataPoint[]
  sensitivity_matrix: SensitivityResult[]
  run_duration_ms: number
}

type EstateTaxContext = Pick<
  EstateMCInputs,
  'stateCode' | 'stateBrackets' | 'filingStatus' | 'hasBypassTrust'
>

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
  taxCtx: EstateTaxContext,
  lawScenario: 'current_law' | 'no_exemption',
): number {
  const FEDERAL_RATE = 0.4
  const effectiveExemption = lawScenario === 'no_exemption' ? 0 : exemption
  const federalTax = Math.max(0, estate - effectiveExemption) * FEDERAL_RATE
  const isMFJ = taxCtx.filingStatus === 'mfj'
  const stateResult = calculateStateEstateTax(
    estate,
    taxCtx.stateCode,
    taxCtx.stateBrackets,
    isMFJ,
    false,
  )
  const stateTax = resolveActiveStateTax(stateResult, taxCtx.hasBypassTrust)
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
    stateCode,
    stateBrackets,
    filingStatus,
    hasBypassTrust,
    yearsUntilDeath,
    baseGrowthRate,
    strategyEstatereduction,
    lawScenario,
    simulationCount,
    includeSensitivity,
    returnMeanPct,
    volatilityPct,
  } = inputs

  const taxCtx: EstateTaxContext = {
    stateCode,
    stateBrackets,
    filingStatus,
    hasBypassTrust,
  }

  const returnMean = (returnMeanPct ?? 7) / 100
  const returnVol = (volatilityPct ?? 12) / 100

  const startTime = Date.now()
  const adjustedEstate = Math.max(0, grossEstate - strategyEstatereduction)

  const finalEstates: number[] = []
  const yearlyEstates: number[][] = Array.from({ length: yearsUntilDeath + 1 }, () => [])

  for (let sim = 0; sim < simulationCount; sim++) {
    let estate = adjustedEstate

    for (let year = 0; year <= yearsUntilDeath; year++) {
      const annualReturn = randomNormal(returnMean, returnVol)
      estate = Math.max(0, estate * (1 + annualReturn))
      yearlyEstates[year].push(estate)
    }

    finalEstates.push(estate)
  }

  const sortedFinals = [...finalEstates].sort((a, b) => a - b)

  const p10_estate = percentile(sortedFinals, 10)
  const p25_estate = percentile(sortedFinals, 25)
  const p50_estate = percentile(sortedFinals, 50)
  const p75_estate = percentile(sortedFinals, 75)
  const p90_estate = percentile(sortedFinals, 90)

  const p10_tax = calcEstateTax(p10_estate, federalExemption, taxCtx, lawScenario)
  const p50_tax = calcEstateTax(p50_estate, federalExemption, taxCtx, lawScenario)
  const p90_tax = calcEstateTax(p90_estate, federalExemption, taxCtx, lawScenario)

  const successCount = sortedFinals.filter(
    (e) => calcEstateTax(e, federalExemption, taxCtx, lawScenario) === 0,
  ).length
  const success_rate = Math.round((successCount / simulationCount) * 100)

  const median_net_to_heirs = p50_estate - p50_tax

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

  const sensitivity_matrix: SensitivityResult[] = []

  if (includeSensitivity) {
    const growthScenarios = [{ label: 'Growth Rate', low: baseGrowthRate - 0.02, high: baseGrowthRate + 0.02 }]
    for (const scenario of growthScenarios) {
      const lowEstate = adjustedEstate * Math.pow(1 + scenario.low, yearsUntilDeath)
      const highEstate = adjustedEstate * Math.pow(1 + scenario.high, yearsUntilDeath)
      sensitivity_matrix.push({
        variable: scenario.label,
        low_value: scenario.low,
        low_tax: calcEstateTax(lowEstate, federalExemption, taxCtx, lawScenario),
        base_tax: p50_tax,
        high_value: scenario.high,
        high_tax: calcEstateTax(highEstate, federalExemption, taxCtx, lawScenario),
      })
    }

    sensitivity_matrix.push({
      variable: 'Federal Exemption',
      low_value: 0,
      low_tax: calcEstateTax(p50_estate, 0, taxCtx, 'no_exemption'),
      base_tax: p50_tax,
      high_value: federalExemption,
      high_tax: calcEstateTax(p50_estate, federalExemption, taxCtx, 'current_law'),
    })

    // State tax sensitivity removed — engine B brackets make flat-rate sweep meaningless; add scenario comparison in MC sprint
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

/**
 * lib/domicile/moveBreakeven.ts
 * Move Breakeven Engine — Session 38 (Step 4 update)
 *
 * Income tax now uses the shared progressive bracket engine:
 *   lib/calculations/stateIncomeTax.ts → calcStateIncomeTaxDelta()
 *
 * Estate tax continues to use state_estate_tax_rules (progressive brackets).
 *
 * Pure calculation — no Supabase, no React.
 */

import {
  calcStateIncomeTaxDelta,
  type StateIncomeTaxBracket,
} from '@/lib/calculations/stateIncomeTax'

export type { StateIncomeTaxBracket }

// Legacy flat-rate type — kept for compatibility until cleanup.
export type StateIncomeTaxRate = {
  state_code: string
  rate_pct: number
  tax_year: number
}

export type StateEstateTaxRule = {
  state: string
  tax_year: number
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type StateBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type MoveBreakevenInput = {
  /** Current domicile state (2-letter) */
  currentState: string
  /** Target domicile state (2-letter) */
  targetState: string
  /** Gross taxable income (wages, cap gains, distributions, etc.) */
  annualIncome: number
  /** Current gross estate value */
  grossEstate: number
  /** MFJ = true, single = false */
  isMFJ: boolean
  /** One-time move friction: legal/filing + real estate transaction costs */
  moveCostTotal: number
  /** Annual professional / compliance overhead delta (e.g. added CPA fees in new state) */
  annualComplianceCostDelta: number
  /** Discount rate for NPV (e.g. 0.05 for 5%) */
  discountRate: number
  /** Planning horizon in years */
  horizonYears: number
  /** Expected annual estate growth rate */
  estateGrowthRate: number
  /** All income tax bracket rows (all states, filtered internally) */
  incomeTaxBrackets: StateIncomeTaxBracket[]
  /** All estate tax bracket rows (all states, all years, filtered internally) */
  estateTaxRules: StateEstateTaxRule[]
}

export type BreakevenYear = {
  year: number
  cumulativeSavings: number
  netPosition: number // negative = still in hole, positive = ahead
  estateTaxSavingsThisYear: number
  incomeTaxSavingsThisYear: number
}

export type MoveBreakevenResult = {
  currentState: string
  targetState: string

  // Annual income tax
  currentIncomeTax: number
  targetIncomeTax: number
  currentIncomeTaxRate: number | null
  targetIncomeTaxRate: number | null
  annualIncomeTaxSavings: number

  // Estate tax (amortized over horizon)
  currentEstateTax: number
  targetEstateTax: number
  estateTaxDeltaTotal: number
  estateTaxAnnualEquivalent: number

  // Combined
  combinedAnnualSavings: number
  netAnnualBenefit: number

  // One-time costs
  moveCostTotal: number

  // Breakeven
  breakevenYears: number | null
  breakevenYearExact: number | null
  npvOfMove: number

  // Year-by-year
  yearByYear: BreakevenYear[]

  // Sensitivity
  sensitivity: {
    estateDown20: { breakevenYears: number | null; npv: number }
    base:         { breakevenYears: number | null; npv: number }
    estateUp20:   { breakevenYears: number | null; npv: number }
  }

  // Flags
  moveIsFinanciallyJustified: boolean
  hasNoEstateTaxBenefit: boolean
  hasNoIncomeTaxBenefit: boolean
}

// ─────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────

function getBracketsForState(
  rules: StateEstateTaxRule[],
  state: string,
): StateBracket[] {
  const latestYear = Math.max(
    ...rules
      .filter((r) => r.state.toUpperCase() === state.toUpperCase())
      .map((r) => r.tax_year),
    0,
  )
  if (latestYear === 0) return []
  return rules
    .filter(
      (r) =>
        r.state.toUpperCase() === state.toUpperCase() &&
        r.tax_year === latestYear,
    )
    .sort((a, b) => a.min_amount - b.min_amount)
}

function calcEstateTax(grossEstate: number, brackets: StateBracket[]): number {
  if (brackets.length === 0) return 0
  const exemption = brackets[0]?.exemption_amount ?? 0
  if (grossEstate <= exemption) return 0
  const taxableEstate = grossEstate - exemption
  let tax = 0
  for (const bracket of brackets) {
    const bracketSize = bracket.max_amount - bracket.min_amount
    if (taxableEstate <= bracket.min_amount) break
    const amountInBracket = Math.min(taxableEstate - bracket.min_amount, bracketSize)
    tax += amountInBracket * (bracket.rate_pct / 100)
  }
  return Math.round(tax)
}

function computeNPV(cashFlows: number[], discountRate: number): number {
  // cashFlows[0] = year 1 savings, etc.
  return cashFlows.reduce((npv, cf, i) => {
    return npv + cf / Math.pow(1 + discountRate, i + 1)
  }, 0)
}

function runScenario(
  input: MoveBreakevenInput,
  grossEstateOverride: number,
): { breakevenYears: number | null; npv: number } {
  const filingStatus = input.isMFJ ? 'mfj' : 'single'
  const currentBrackets = getBracketsForState(input.estateTaxRules, input.currentState)
  const targetBrackets  = getBracketsForState(input.estateTaxRules, input.targetState)

  const incomeDelta = calcStateIncomeTaxDelta({
    currentState: input.currentState,
    targetState: input.targetState,
    ordinaryIncome: input.annualIncome,
    filingStatus,
    brackets: input.incomeTaxBrackets,
  })

  const cashFlows: number[] = []
  let cumulativeSavings = -input.moveCostTotal
  let breakevenYears: number | null = null

  for (let yr = 1; yr <= input.horizonYears; yr++) {
    const estateThisYear = grossEstateOverride * Math.pow(1 + input.estateGrowthRate, yr)
    const currentEstateTax = calcEstateTax(estateThisYear, currentBrackets)
    const targetEstateTax  = calcEstateTax(estateThisYear, targetBrackets)
    const estateSavingsThisYear = currentEstateTax - targetEstateTax

    const netSavingsThisYear =
      incomeDelta.annualSavings +
      estateSavingsThisYear -
      input.annualComplianceCostDelta

    cashFlows.push(netSavingsThisYear)

    cumulativeSavings += netSavingsThisYear

    if (breakevenYears === null && cumulativeSavings >= 0) {
      breakevenYears = yr
    }
  }

  const npv = computeNPV(cashFlows, input.discountRate) - input.moveCostTotal

  return { breakevenYears, npv }
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export function calculateMoveBreakeven(input: MoveBreakevenInput): MoveBreakevenResult {
  const filingStatus = input.isMFJ ? 'mfj' : 'single'
  const currentBrackets = getBracketsForState(input.estateTaxRules, input.currentState)
  const targetBrackets  = getBracketsForState(input.estateTaxRules, input.targetState)

  const incomeDelta = calcStateIncomeTaxDelta({
    currentState: input.currentState,
    targetState: input.targetState,
    ordinaryIncome: input.annualIncome,
    filingStatus,
    brackets: input.incomeTaxBrackets,
  })
  const annualIncomeTaxSavings = incomeDelta.annualSavings

  const currentEstateTax = calcEstateTax(input.grossEstate, currentBrackets)
  const targetEstateTax  = calcEstateTax(input.grossEstate, targetBrackets)
  const estateTaxDeltaTotal = currentEstateTax - targetEstateTax
  const estateTaxAnnualEquivalent = estateTaxDeltaTotal / input.horizonYears

  const combinedAnnualSavings = annualIncomeTaxSavings + estateTaxAnnualEquivalent
  const netAnnualBenefit = combinedAnnualSavings - input.annualComplianceCostDelta

  // ── Year-by-year table ────────────────────────────────────────
  const yearByYear: BreakevenYear[] = []
  let cumulativeSavings = -input.moveCostTotal
  let breakevenYears: number | null = null
  let breakevenYearExact: number | null = null

  const cashFlows: number[] = []

  for (let yr = 1; yr <= input.horizonYears; yr++) {
    const estateThisYear = input.grossEstate * Math.pow(1 + input.estateGrowthRate, yr)
    const currentETY = calcEstateTax(estateThisYear, currentBrackets)
    const targetETY  = calcEstateTax(estateThisYear, targetBrackets)
    const estateSavingsThisYear = currentETY - targetETY
    const netSavingsThisYear =
      annualIncomeTaxSavings + estateSavingsThisYear - input.annualComplianceCostDelta

    cashFlows.push(netSavingsThisYear)

    const prevCumulative = cumulativeSavings
    cumulativeSavings += netSavingsThisYear

    if (breakevenYears === null && cumulativeSavings >= 0) {
      breakevenYears = yr
      if (netSavingsThisYear > 0) {
        breakevenYearExact = (yr - 1) + Math.abs(prevCumulative) / netSavingsThisYear
      } else {
        breakevenYearExact = yr
      }
    }

    yearByYear.push({
      year: yr,
      cumulativeSavings,
      netPosition: cumulativeSavings,
      estateTaxSavingsThisYear: estateSavingsThisYear,
      incomeTaxSavingsThisYear: annualIncomeTaxSavings,
    })
  }

  const npvOfMove = computeNPV(cashFlows, input.discountRate) - input.moveCostTotal

  // ── Sensitivity ───────────────────────────────────────────────
  const down20 = runScenario(input, input.grossEstate * 0.8)
  const base   = { breakevenYears, npv: npvOfMove }
  const up20   = runScenario(input, input.grossEstate * 1.2)

  return {
    currentState: input.currentState,
    targetState: input.targetState,
    currentIncomeTax: incomeDelta.currentTax,
    targetIncomeTax: incomeDelta.targetTax,
    currentIncomeTaxRate: incomeDelta.currentTopRate,
    targetIncomeTaxRate: incomeDelta.targetTopRate,
    annualIncomeTaxSavings,
    currentEstateTax,
    targetEstateTax,
    estateTaxDeltaTotal,
    estateTaxAnnualEquivalent,
    combinedAnnualSavings,
    netAnnualBenefit,
    moveCostTotal: input.moveCostTotal,
    breakevenYears,
    breakevenYearExact,
    npvOfMove,
    yearByYear,
    sensitivity: {
      estateDown20: down20,
      base,
      estateUp20: up20,
    },
    moveIsFinanciallyJustified: npvOfMove > 0,
    hasNoEstateTaxBenefit: estateTaxDeltaTotal === 0,
    hasNoIncomeTaxBenefit: annualIncomeTaxSavings === 0,
  }
}

/**
 * lib/domicile/moveBreakeven.ts
 * Move Breakeven Engine — Session 38
 *
 * Leading-practice model:
 *   Annual tax delta (income + estate amortized) vs. one-time move friction
 *   → years to breakeven, NPV of move over horizon, sensitivity table
 *
 * Pure calculation — no Supabase, no React. Call from server components or client.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

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
  /** All income tax rate rows (all states, filtered internally) */
  incomeTaxRates: StateIncomeTaxRate[]
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

  // ── Annual income tax ──────────────────────────
  currentIncomeTaxRate: number | null   // top marginal rate pct
  targetIncomeTaxRate: number | null
  annualIncomeTaxSavings: number        // positive = target is cheaper

  // ── Estate tax (amortized over horizon) ────────
  currentEstateTax: number             // at current gross estate
  targetEstateTax: number
  estateTaxDeltaTotal: number          // currentEstateTax - targetEstateTax
  /** Flat per-year equivalent (not discounted) */
  estateTaxAnnualEquivalent: number

  // ── Combined annual benefit ────────────────────
  combinedAnnualSavings: number        // income + estate amortized - compliance delta
  netAnnualBenefit: number             // combinedAnnualSavings - annualComplianceCostDelta

  // ── One-time costs ─────────────────────────────
  moveCostTotal: number

  // ── Breakeven ─────────────────────────────────
  breakevenYears: number | null        // null = never breaks even in horizon
  breakevenYearExact: number | null    // fractional year
  npvOfMove: number                    // NPV over full horizon (positive = move wins)

  // ── Year-by-year table ─────────────────────────
  yearByYear: BreakevenYear[]

  // ── Sensitivity (annual savings at ±20% estate) ─
  sensitivity: {
    estateDown20: { breakevenYears: number | null; npv: number }
    base:         { breakevenYears: number | null; npv: number }
    estateUp20:   { breakevenYears: number | null; npv: number }
  }

  // ── Flags ──────────────────────────────────────
  moveIsFinanciallyJustified: boolean  // npv > 0 within horizon
  hasNoEstateTaxBenefit: boolean       // both states have same (or no) estate tax
  hasNoIncomeTaxBenefit: boolean
}

// ─────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────

function getLatestIncomeTaxRate(
  rates: StateIncomeTaxRate[],
  stateCode: string,
): number | null {
  const rows = rates
    .filter((r) => r.state_code.toUpperCase() === stateCode.toUpperCase())
    .sort((a, b) => b.tax_year - a.tax_year)
  return rows.length > 0 ? rows[0].rate_pct : null
}

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

/**
 * Progressive bracket estate tax calculation.
 * Mirrors the pattern used in lib/calculations/stateEstateTax.ts.
 * Returns 0 if no brackets (state has no estate tax).
 */
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
  const currentBrackets = getBracketsForState(input.estateTaxRules, input.currentState)
  const targetBrackets  = getBracketsForState(input.estateTaxRules, input.targetState)

  const currentIncomeTaxRate = getLatestIncomeTaxRate(input.incomeTaxRates, input.currentState) ?? 0
  const targetIncomeTaxRate  = getLatestIncomeTaxRate(input.incomeTaxRates, input.targetState)  ?? 0
  const annualIncomeTaxSavings =
    input.annualIncome * ((currentIncomeTaxRate - targetIncomeTaxRate) / 100)

  const cashFlows: number[] = []
  let cumulativeSavings = -input.moveCostTotal
  let breakevenYears: number | null = null

  for (let yr = 1; yr <= input.horizonYears; yr++) {
    const estateThisYear = grossEstateOverride * Math.pow(1 + input.estateGrowthRate, yr)
    const currentEstateTax = calcEstateTax(estateThisYear, currentBrackets)
    const targetEstateTax  = calcEstateTax(estateThisYear, targetBrackets)
    const estateSavingsThisYear = currentEstateTax - targetEstateTax

    const netSavingsThisYear =
      annualIncomeTaxSavings +
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
  const currentBrackets = getBracketsForState(input.estateTaxRules, input.currentState)
  const targetBrackets  = getBracketsForState(input.estateTaxRules, input.targetState)

  const currentIncomeTaxRate = getLatestIncomeTaxRate(input.incomeTaxRates, input.currentState)
  const targetIncomeTaxRate  = getLatestIncomeTaxRate(input.incomeTaxRates, input.targetState)

  const currentITR = currentIncomeTaxRate ?? 0
  const targetITR  = targetIncomeTaxRate  ?? 0
  const annualIncomeTaxSavings = input.annualIncome * ((currentITR - targetITR) / 100)

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
    const incomeSavingsThisYear = annualIncomeTaxSavings

    const netSavingsThisYear =
      incomeSavingsThisYear + estateSavingsThisYear - input.annualComplianceCostDelta

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
      incomeTaxSavingsThisYear: incomeSavingsThisYear,
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
    currentIncomeTaxRate,
    targetIncomeTaxRate,
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

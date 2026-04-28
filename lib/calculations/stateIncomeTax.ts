/**
 * lib/calculations/stateIncomeTax.ts
 * Session 38 — Shared State Income Tax Engine
 *
 * SINGLE SOURCE OF TRUTH for all state income tax calculations.
 */

export type StateIncomeTaxBracket = {
  state: string
  tax_year: number
  filing_status: 'single' | 'mfj'
  min_amount: number
  max_amount: number | null
  rate_pct: number
}

export type StateIncomeTaxInput = {
  stateCode: string | null | undefined
  ordinaryIncome: number
  capitalGains?: number
  filingStatus: 'single' | 'mfj'
  brackets: StateIncomeTaxBracket[]
  taxYear?: number
}

export type StateIncomeTaxResult = {
  state: string
  stateTax: number
  taxOnOrdinaryIncome: number
  taxOnCapitalGains: number
  effectiveRate: number
  topBracketRate: number | null
  hasBrackets: boolean
  filingStatus: 'single' | 'mfj'
}

export function getBracketsForState(
  brackets: StateIncomeTaxBracket[],
  stateCode: string,
  filingStatus: 'single' | 'mfj',
  taxYear?: number,
): StateIncomeTaxBracket[] {
  const code = stateCode.toUpperCase()
  const availableYears = brackets
    .filter((b) => b.state.toUpperCase() === code && b.filing_status === filingStatus)
    .map((b) => b.tax_year)
  if (availableYears.length === 0) return []

  const targetYear = taxYear
    ? Math.max(...availableYears.filter((y) => y <= taxYear))
    : Math.max(...availableYears)

  if (!isFinite(targetYear)) return []

  return brackets
    .filter(
      (b) =>
        b.state.toUpperCase() === code &&
        b.filing_status === filingStatus &&
        b.tax_year === targetYear,
    )
    .sort((a, b) => a.min_amount - b.min_amount)
}

export function calcProgressiveTax(
  taxableIncome: number,
  stateBrackets: StateIncomeTaxBracket[],
): { tax: number; topBracketRate: number | null } {
  if (taxableIncome <= 0 || stateBrackets.length === 0) {
    return { tax: 0, topBracketRate: null }
  }

  let tax = 0
  let topBracketRate: number | null = null

  for (const bracket of stateBrackets) {
    if (taxableIncome <= bracket.min_amount) break

    const bracketMax = bracket.max_amount ?? Infinity
    const amountInBracket = Math.min(taxableIncome, bracketMax) - bracket.min_amount

    if (amountInBracket > 0) {
      tax += amountInBracket * (bracket.rate_pct / 100)
      topBracketRate = bracket.rate_pct
    }
  }

  return { tax: Math.round(tax * 100) / 100, topBracketRate }
}

export function calculateStateIncomeTax(input: StateIncomeTaxInput): StateIncomeTaxResult {
  const {
    stateCode,
    ordinaryIncome,
    capitalGains = 0,
    filingStatus,
    brackets,
    taxYear,
  } = input

  const noTax: StateIncomeTaxResult = {
    state: stateCode ?? 'unknown',
    stateTax: 0,
    taxOnOrdinaryIncome: 0,
    taxOnCapitalGains: 0,
    effectiveRate: 0,
    topBracketRate: null,
    hasBrackets: false,
    filingStatus,
  }

  if (!stateCode) return noTax

  const code = stateCode.toUpperCase()
  const stateBrackets = getBracketsForState(brackets, code, filingStatus, taxYear)

  if (stateBrackets.length === 0) {
    return { ...noTax, state: code, hasBrackets: false }
  }

  const totalIncome = ordinaryIncome + capitalGains
  const { tax, topBracketRate } = calcProgressiveTax(totalIncome, stateBrackets)

  const taxOnOrdinaryIncome =
    totalIncome > 0 ? Math.round(tax * (ordinaryIncome / totalIncome) * 100) / 100 : 0
  const taxOnCapitalGains = Math.round((tax - taxOnOrdinaryIncome) * 100) / 100

  const effectiveRate = totalIncome > 0 ? tax / totalIncome : 0

  return {
    state: code,
    stateTax: tax,
    taxOnOrdinaryIncome,
    taxOnCapitalGains,
    effectiveRate,
    topBracketRate,
    hasBrackets: true,
    filingStatus,
  }
}

export function getTopMarginalRate(
  stateCode: string | null | undefined,
  income: number,
  filingStatus: 'single' | 'mfj',
  brackets: StateIncomeTaxBracket[],
  taxYear?: number,
): number | null {
  if (!stateCode) return null
  const stateBrackets = getBracketsForState(
    brackets,
    stateCode.toUpperCase(),
    filingStatus,
    taxYear,
  )
  if (stateBrackets.length === 0) return null

  let topRate: number | null = null
  for (const bracket of stateBrackets) {
    if (income > bracket.min_amount) {
      topRate = bracket.rate_pct
    }
  }
  return topRate
}

export function calcStateIncomeTaxDelta(params: {
  currentState: string
  targetState: string
  ordinaryIncome: number
  capitalGains?: number
  filingStatus: 'single' | 'mfj'
  brackets: StateIncomeTaxBracket[]
  taxYear?: number
}): {
  currentTax: number
  targetTax: number
  annualSavings: number
  currentEffectiveRate: number
  targetEffectiveRate: number
  currentTopRate: number | null
  targetTopRate: number | null
} {
  const current = calculateStateIncomeTax({
    stateCode: params.currentState,
    ordinaryIncome: params.ordinaryIncome,
    capitalGains: params.capitalGains,
    filingStatus: params.filingStatus,
    brackets: params.brackets,
    taxYear: params.taxYear,
  })

  const target = calculateStateIncomeTax({
    stateCode: params.targetState,
    ordinaryIncome: params.ordinaryIncome,
    capitalGains: params.capitalGains,
    filingStatus: params.filingStatus,
    brackets: params.brackets,
    taxYear: params.taxYear,
  })

  return {
    currentTax: current.stateTax,
    targetTax: target.stateTax,
    annualSavings: current.stateTax - target.stateTax,
    currentEffectiveRate: current.effectiveRate,
    targetEffectiveRate: target.effectiveRate,
    currentTopRate: current.topBracketRate,
    targetTopRate: target.topBracketRate,
  }
}

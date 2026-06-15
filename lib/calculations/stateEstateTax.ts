/**
 * CANONICAL STATE ESTATE TAX ENGINE
 * ==================================
 * Single source of truth for state estate tax calculations.
 * ALL surfaces that display state estate tax must import from this file.
 *
 * DO NOT add state estate tax logic to narrativeEngine, exportMappers, or components.
 *
 * Exported functions:
 *   calculateStateEstateTax()    — both no-CST and with-CST scenarios
 *   calculateStateTaxScenarios() — advisor PDF comparison table
 *
 * @see docs/CALCULATION_ENGINES.md
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StateBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type StateEstateTaxResult = {
  /** State tax without a Credit Shelter Trust (worst case for no-portability MFJ) */
  stateTax: number
  /** State tax WITH a Credit Shelter Trust in place (best case for no-portability MFJ) */
  stateTaxWithCST: number
  /** Dollar savings from implementing a CST. Zero for single or portability states. */
  cstBenefit: number
  /** True if state has no portability AND household is MFJ — means CST is actionable */
  hasPortabilityGap: boolean
  /** NY cliff was triggered (estate > 105% of exemption) */
  nyCliffTriggered: boolean
  /** Exemption used in the no-CST calculation */
  exemptionUsed: number
  /** Taxable estate in the no-CST calculation */
  taxableEstate: number
  /** Taxable estate in the with-CST calculation (second death, survivor portion) */
  taxableEstateWithCST: number
  /** Amount funded into bypass/CST at first death (capped at min(exemption, first-spouse share)) */
  bypassFundingAmount: number
  /** Effective rate = stateTax / grossEstate */
  effectiveRate: number
}

export type StateEstateTaxOptions = {
  /**
   * First-to-die spouse's share of combined estate at second death.
   * WA community-property default: grossEstate / 2.
   */
  firstSpouseShare?: number
}

// ─── Modeled estate-tax states (brackets in `state_estate_tax_rules`) ─────────

export const MODELED_ESTATE_TAX_STATES = [
  'CT',
  'DC',
  'HI',
  'IL',
  'MA',
  'MD',
  'ME',
  'MN',
  'NY',
  'OR',
  'RI',
  'VT',
  'WA',
] as const

/** States with no broad-based personal income tax (zero brackets is correct). */
export const NO_STATE_INCOME_TAX_STATES = [
  'AK',
  'FL',
  'NV',
  'NH',
  'SD',
  'TN',
  'TX',
  'WA',
  'WY',
] as const

/** States with inheritance tax rules in `state_inheritance_tax_rules`. */
export const MODELED_INHERITANCE_TAX_STATES = [
  'IA',
  'KY',
  'MD',
  'NE',
  'NJ',
  'PA',
] as const

// ─── No-portability states ────────────────────────────────────────────────────

const NO_PORTABILITY_STATES = new Set([
  'WA', 'OR', 'MN', 'MA', 'ME', 'IL', 'MD', 'RI', 'VT', 'HI', 'NY',
  'DC', 'NE', 'IA', 'KY', 'PA', 'NJ',
])

const STATE_DISPLAY_NAMES: Record<string, string> = {
  WA: 'Washington',
  OR: 'Oregon',
  MN: 'Minnesota',
  MA: 'Massachusetts',
  IL: 'Illinois',
  NY: 'New York',
  MD: 'Maryland',
  CT: 'Connecticut',
  ME: 'Maine',
  HI: 'Hawaii',
  NJ: 'New Jersey',
  RI: 'Rhode Island',
  VT: 'Vermont',
}

// ─── Core bracket engine ──────────────────────────────────────────────────────

function applyBrackets(taxableAmount: number, brackets: StateBracket[]): number {
  if (taxableAmount <= 0 || brackets.length === 0) return 0
  let tax = 0
  for (const bracket of brackets) {
    const bracketMin = bracket.min_amount
    const bracketMax = bracket.max_amount >= 9_999_999_999 ? Infinity : bracket.max_amount
    if (taxableAmount <= bracketMin) break
    const inBracket = Math.min(taxableAmount, bracketMax) - bracketMin
    if (inBracket > 0) tax += inBracket * (bracket.rate_pct / 100)
  }
  return Math.round(tax)
}

function computeStateTaxForExemption(
  grossEstate: number,
  exemption: number,
  brackets: StateBracket[],
  stateCode: string,
): { tax: number; nyCliffTriggered: boolean; taxableEstate: number } {
  if (brackets.length === 0 || grossEstate <= 0) {
    return { tax: 0, nyCliffTriggered: false, taxableEstate: 0 }
  }

  let taxableEstate: number
  let nyCliffTriggered = false

  if (stateCode === 'NY') {
    const cliffThreshold = exemption * 1.05
    if (grossEstate > cliffThreshold) {
      taxableEstate = grossEstate
      nyCliffTriggered = true
    } else {
      taxableEstate = Math.max(0, grossEstate - exemption)
    }
  } else {
    taxableEstate = Math.max(0, grossEstate - exemption)
  }

  if (taxableEstate <= 0) {
    return { tax: 0, nyCliffTriggered, taxableEstate: 0 }
  }

  let tax = applyBrackets(taxableEstate, brackets)

  if (stateCode === 'CT') {
    tax = Math.min(tax, 15_000_000)
  }

  return { tax, nyCliffTriggered, taxableEstate: Math.round(taxableEstate) }
}

/** Bypass funding at first death — capped by first spouse's share (WA CP default: G/2). */
export function computeBypassFundingAmount(
  grossEstate: number,
  exemption: number,
  firstSpouseShare?: number,
): number {
  if (grossEstate <= 0 || exemption <= 0) return 0
  const share = firstSpouseShare ?? grossEstate / 2
  return Math.min(exemption, Math.max(0, share))
}

export function calculateStateEstateTax(
  grossEstate: number,
  stateCode: string,
  brackets: StateBracket[],
  isMFJ: boolean,
  hasCSTInPlace = false,
  options?: StateEstateTaxOptions,
): StateEstateTaxResult {
  void hasCSTInPlace

  const code = stateCode.toUpperCase().trim()

  if (brackets.length === 0 || grossEstate <= 0) {
    return {
      stateTax: 0,
      stateTaxWithCST: 0,
      cstBenefit: 0,
      hasPortabilityGap: false,
      nyCliffTriggered: false,
      exemptionUsed: 0,
      taxableEstate: 0,
      taxableEstateWithCST: 0,
      bypassFundingAmount: 0,
      effectiveRate: 0,
    }
  }

  const singleExemption = brackets[0].exemption_amount ?? 0
  const hasPortabilityGap = isMFJ && NO_PORTABILITY_STATES.has(code)

  const exemptionNoCst = singleExemption
  const noCst = computeStateTaxForExemption(grossEstate, exemptionNoCst, brackets, code)

  let withCst = noCst
  let bypassFundingAmount = 0
  if (hasPortabilityGap) {
    bypassFundingAmount = computeBypassFundingAmount(
      grossEstate,
      singleExemption,
      options?.firstSpouseShare,
    )
    const survivorEstate = Math.max(0, grossEstate - bypassFundingAmount)
    withCst = computeStateTaxForExemption(survivorEstate, singleExemption, brackets, code)
  }

  const cstBenefit = Math.max(0, noCst.tax - withCst.tax)
  const effectiveRate = grossEstate > 0 ? noCst.tax / grossEstate : 0

  return {
    stateTax: noCst.tax,
    stateTaxWithCST: withCst.tax,
    cstBenefit,
    hasPortabilityGap,
    nyCliffTriggered: noCst.nyCliffTriggered,
    exemptionUsed: exemptionNoCst,
    taxableEstate: noCst.taxableEstate,
    taxableEstateWithCST: withCst.taxableEstate,
    bypassFundingAmount,
    effectiveRate,
  }
}

/** Modeled death sequence for state estate tax display (marital deduction at first death). */
export type StateEstateDeathPhase = 'first_death' | 'second_death'

/** MFJ + spouse: unlimited marital deduction → $0 state estate tax at first death. */
export function shouldZeroStateTaxAtFirstDeath(
  isMFJ: boolean,
  hasSpouse: boolean,
  deathPhase: StateEstateDeathPhase,
): boolean {
  return deathPhase === 'first_death' && isMFJ && hasSpouse
}

export type StateTaxForDeathPhaseResult = StateEstateTaxResult & {
  isFirstDeath: boolean
  activeStateTax: number
}

/**
 * Resolve state tax for a death phase. First death (MFJ + spouse) returns $0 even when
 * `calculateStateEstateTax` on the same gross would be non-zero — prevents mis-wiring
 * the raw engine to a first-death surface.
 */
export function resolveStateTaxForDeathPhase(params: {
  grossEstate: number
  stateCode: string
  brackets: StateBracket[]
  isMFJ: boolean
  hasSpouse: boolean
  deathPhase: StateEstateDeathPhase
  hasBypassTrust?: boolean
  options?: StateEstateTaxOptions
}): StateTaxForDeathPhaseResult {
  const exemption = params.brackets[0]?.exemption_amount ?? 0

  if (shouldZeroStateTaxAtFirstDeath(params.isMFJ, params.hasSpouse, params.deathPhase)) {
    return {
      stateTax: 0,
      stateTaxWithCST: 0,
      cstBenefit: 0,
      hasPortabilityGap: params.isMFJ && NO_PORTABILITY_STATES.has(params.stateCode.toUpperCase().trim()),
      nyCliffTriggered: false,
      exemptionUsed: exemption,
      taxableEstate: 0,
      taxableEstateWithCST: 0,
      bypassFundingAmount: 0,
      effectiveRate: 0,
      isFirstDeath: true,
      activeStateTax: 0,
    }
  }

  const result = calculateStateEstateTax(
    params.grossEstate,
    params.stateCode,
    params.brackets,
    params.isMFJ,
    params.hasBypassTrust ?? false,
    params.options,
  )

  return {
    ...result,
    isFirstDeath: false,
    activeStateTax: resolveActiveStateTax(result, params.hasBypassTrust ?? false),
  }
}

/** Active CST in place → use with-CST amount; otherwise status-quo (no CST). */
export function resolveActiveStateTax(
  result: StateEstateTaxResult,
  hasBypassTrust: boolean,
): number {
  if (hasBypassTrust && result.hasPortabilityGap) return result.stateTaxWithCST
  return result.stateTax
}

export function calculateStateTaxScenarios(params: {
  grossEstate: number
  stateCode: string
  brackets: StateBracket[]
  filingStatus: string | null | undefined
}) {
  const result = calculateStateEstateTax(
    params.grossEstate,
    params.stateCode,
    params.brackets,
    isMFJFilingStatus(params.filingStatus),
  )

  return {
    withBypassTrust: { ...result, stateTax: result.stateTaxWithCST },
    withoutBypassTrust: { ...result, stateTax: result.stateTax },
    planningGap: result.cstBenefit,
    hasPortability: !result.hasPortabilityGap,
    showScenarioTable: result.cstBenefit > 0,
  }
}

export function isMFJFilingStatus(filingStatus: string | null | undefined): boolean {
  const fs = (filingStatus ?? '').toLowerCase().trim()
  return fs === 'mfj' || fs === 'married_filing_jointly' || fs === 'married filing jointly' || fs === 'married_joint'
}

export function stateHasEstateTax(stateCode: string | null | undefined): boolean {
  if (!stateCode) return false
  return (MODELED_ESTATE_TAX_STATES as readonly string[]).includes(
    stateCode.toUpperCase().trim(),
  )
}

export function stateHasNoPortability(stateCode: string | null | undefined): boolean {
  if (!stateCode) return false
  return NO_PORTABILITY_STATES.has(stateCode.toUpperCase().trim())
}

export function getStateDisplayName(stateCode: string | null | undefined): string {
  if (!stateCode) return 'State'
  const code = stateCode.toUpperCase().trim()
  return STATE_DISPLAY_NAMES[code] ?? code
}

export function getPortabilityGapLabel(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null
  const code = stateCode.toUpperCase().trim()
  if (!NO_PORTABILITY_STATES.has(code)) return null
  const name = getStateDisplayName(code)
  return `${name} does not recognize federal portability. Without a Credit Shelter Trust, one spouse's exemption is lost at first death.`
}

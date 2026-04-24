// Sprint 66 - Updated to use database exemptions from state_estate_tax_rules
// Hardcoded fallbacks retained for offline/test use only

import {
  calculateStateEstateTax as calculateCanonicalStateEstateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'

export type StateTaxCode = 'WA' | 'MA' | 'OR' | 'NY' | 'CT' | 'AZ' | 'other'

export type InheritanceTaxCode = 'PA' | 'NJ' | 'KY' | 'NE' | 'IA' | 'MD'

export interface StateExemptionRow {
  year: number
  exemption: number
  topRate: number
  hasPortability: boolean
  hasSunset: boolean
  notes?: string
}

export interface StateRuleSet {
  code: StateTaxCode
  name: string
  hasEstateTax: boolean
  exemptionSchedule: StateExemptionRow[]
  specialRules?: string[]
}

// DB row shape returned from get_state_exemptions RPC
export interface DbStateExemption {
  state: string
  tax_year: number
  exemption_amount: number
  top_rate: number // already divided by 100 in RPC
}

// ── parseStateTaxCode ─────────────────────────────────────────────────────────
export function parseStateTaxCode(state: string | null | undefined): StateTaxCode {
  const valid: StateTaxCode[] = ['WA', 'MA', 'OR', 'NY', 'CT', 'AZ']
  if (state && valid.includes(state as StateTaxCode)) return state as StateTaxCode
  return 'other'
}

/** US postal abbrev → full name from profile (`state_primary`) when estate tax modeling uses `other`. */
export const US_STATE_POSTAL_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

// ── Hardcoded fallbacks (used when DB data not available) ─────────────────────
const FALLBACK_EXEMPTIONS: Record<StateTaxCode, Record<number, number>> = {
  WA: { 2024: 2193000, 2025: 2193000, 2026: 3000000, 2027: 3000000, 2028: 3000000 },
  NY: { 2024: 6940000, 2025: 7160000, 2026: 7160000, 2027: 7160000, 2028: 7160000 },
  MA: { 2024: 2000000, 2025: 2000000, 2026: 2000000, 2027: 2000000, 2028: 2000000 },
  OR: { 2024: 1000000, 2025: 1000000, 2026: 1000000, 2027: 1000000, 2028: 1000000 },
  CT: { 2024: 13610000, 2025: 13990000, 2026: 13990000, 2027: 13990000, 2028: 13990000 },
  AZ: { 2024: Infinity, 2025: Infinity, 2026: Infinity, 2027: Infinity, 2028: Infinity },
  other: { 2024: Infinity, 2025: Infinity, 2026: Infinity, 2027: Infinity, 2028: Infinity },
}

const FALLBACK_TOP_RATES: Record<StateTaxCode, number> = {
  WA: 0.20, NY: 0.16, MA: 0.16, OR: 0.16, CT: 0.12, AZ: 0, other: 0,
}

const STATE_NAMES: Record<StateTaxCode, string> = {
  WA: 'Washington', NY: 'New York', MA: 'Massachusetts',
  OR: 'Oregon', CT: 'Connecticut', AZ: 'Arizona', other: 'Other',
}

const SPECIAL_RULES: Record<StateTaxCode, string[]> = {
  WA: ['no_portability', 'inflation_indexed'],
  NY: ['ny_cliff', 'no_portability'],
  MA: ['no_portability', 'flat_exemption'],
  OR: ['no_portability', 'flat_exemption', 'low_threshold'],
  CT: ['tracks_federal', 'ct_tax_cap'],
  AZ: [],
  other: [],
}

// ── Primary exported function ─────────────────────────────────────────────────

/**
 * Get the state estate tax exemption for a given state and year.
 * Uses DB exemptions when provided, falls back to hardcoded values.
 * Returns Infinity for states with no estate tax.
 */
export function getStateExemptionForYear(
  stateCode: StateTaxCode,
  year: number,
  federalExemption?: number,
  dbExemptions?: DbStateExemption[]
): number {
  if (stateCode === 'AZ' || stateCode === 'other') return Infinity

  // Try DB exemptions first
  if (dbExemptions && dbExemptions.length > 0) {
    const match = dbExemptions.find(
      r => r.state === stateCode && r.tax_year === year
    )
    if (match) return match.exemption_amount

    // Use most recent year from DB if exact year not found
    const stateRows = dbExemptions
      .filter(r => r.state === stateCode && r.tax_year <= year)
      .sort((a, b) => b.tax_year - a.tax_year)
    if (stateRows.length > 0) return stateRows[0].exemption_amount
  }

  // CT tracks federal
  if (stateCode === 'CT' && federalExemption) return federalExemption

  // Fallback to hardcoded
  const fallback = FALLBACK_EXEMPTIONS[stateCode]
  if (fallback[year]) return fallback[year]

  // Use most recent hardcoded year
  const years = Object.keys(fallback).map(Number).sort((a, b) => b - a)
  return fallback[years[0]] ?? Infinity
}

/**
 * Get top rate for a state and year from DB or fallback.
 */
export function getStateTopRate(
  stateCode: StateTaxCode,
  year: number,
  dbExemptions?: DbStateExemption[]
): number {
  if (stateCode === 'AZ' || stateCode === 'other') return 0

  if (dbExemptions && dbExemptions.length > 0) {
    const match = dbExemptions.find(
      r => r.state === stateCode && r.tax_year === year
    )
    if (match) return match.top_rate
  }

  return FALLBACK_TOP_RATES[stateCode] ?? 0
}

/**
 * Calculate state estate tax for a given gross estate, state, and year.
 * Handles NY cliff rule, WA no-portability, MA/OR flat exemptions.
 */
export function calculateStateEstateTax(params: {
  grossEstate: number
  stateCode: StateTaxCode
  year: number
  federalExemption?: number
  dsue?: number
  dbExemptions?: DbStateExemption[]
}): {
  stateTax: number
  exemptionUsed: number
  taxableEstate: number
  nyCliffTriggered: boolean
  effectiveRate: number
} {
  const { grossEstate, stateCode, year, federalExemption, dsue = 0, dbExemptions } = params

  if (stateCode === 'AZ' || stateCode === 'other' || grossEstate <= 0) {
    return { stateTax: 0, exemptionUsed: 0, taxableEstate: 0, nyCliffTriggered: false, effectiveRate: 0 }
  }

  const baseExemption = getStateExemptionForYear(stateCode, year, federalExemption, dbExemptions)
  if (!isFinite(baseExemption)) {
    return { stateTax: 0, exemptionUsed: 0, taxableEstate: 0, nyCliffTriggered: false, effectiveRate: 0 }
  }

  // stateRegistry only has exemption + top-rate rows; construct a minimal bracket set
  // and delegate tax logic to the canonical calculator.
  const topRate = getStateTopRate(stateCode, year, dbExemptions)
  const brackets: StateBracket[] = [{
    min_amount: 0,
    max_amount: 9_999_999_999,
    rate_pct: topRate * 100,
    exemption_amount: baseExemption,
  }]

  const hasPortability = !SPECIAL_RULES[stateCode]?.includes('no_portability')
  const isMFJ = dsue > 0
  const canonical = calculateCanonicalStateEstateTax(
    grossEstate,
    stateCode,
    brackets,
    isMFJ,
    false,
  )

  const effectiveExemption = hasPortability ? baseExemption + dsue : baseExemption

  return {
    stateTax: Math.round(canonical.stateTax),
    exemptionUsed: effectiveExemption,
    taxableEstate: Math.round(canonical.taxableEstate),
    nyCliffTriggered: canonical.nyCliffTriggered,
    effectiveRate: canonical.effectiveRate,
  }
}

/**
 * Generate year-by-year state tax for a projection range.
 */
export function getYearByYearStateTax(params: {
  grossEstateByYear: Record<number, number>
  stateCode: StateTaxCode
  federalExemption?: number
  dsue?: number
  dbExemptions?: DbStateExemption[]
}): Record<number, ReturnType<typeof calculateStateEstateTax>> {
  const { grossEstateByYear, stateCode, federalExemption, dsue, dbExemptions } = params
  const result: Record<number, ReturnType<typeof calculateStateEstateTax>> = {}

  for (const [yearStr, grossEstate] of Object.entries(grossEstateByYear)) {
    const year = Number(yearStr)
    result[year] = calculateStateEstateTax({
      grossEstate, stateCode, year, federalExemption, dsue, dbExemptions
    })
  }

  return result
}

// ── NY cliff edge case validator ──────────────────────────────────────────────
// Used in Sprint 66 validation tests

export interface NYCliffTestCase {
  label: string
  estateAsMultiple: number // e.g. 1.04 = 104% of exemption
  expectedCliff: boolean
}

export const NY_CLIFF_TEST_CASES: NYCliffTestCase[] = [
  { label: '100% of exemption', estateAsMultiple: 1.00, expectedCliff: false },
  { label: '104% of exemption', estateAsMultiple: 1.04, expectedCliff: false },
  { label: '105% of exemption', estateAsMultiple: 1.05, expectedCliff: false },
  { label: '106% of exemption', estateAsMultiple: 1.06, expectedCliff: true },
  { label: '150% of exemption', estateAsMultiple: 1.50, expectedCliff: true },
  { label: '200% of exemption', estateAsMultiple: 2.00, expectedCliff: true },
]

export function validateNYCliffCases(
  year: number,
  dbExemptions?: DbStateExemption[]
): { label: string; passed: boolean; expected: boolean; actual: boolean; estate: number }[] {
  const exemption = getStateExemptionForYear('NY', year, undefined, dbExemptions)

  return NY_CLIFF_TEST_CASES.map(tc => {
    const estate = Math.round(exemption * tc.estateAsMultiple)
    const result = calculateStateEstateTax({
      grossEstate: estate, stateCode: 'NY', year, dbExemptions
    })
    return {
      label: tc.label,
      passed: result.nyCliffTriggered === tc.expectedCliff,
      expected: tc.expectedCliff,
      actual: result.nyCliffTriggered,
      estate,
    }
  })
}

// ── Inheritance tax (separate from estate tax) ────────────────────────────────

export interface InheritanceTaxResult {
  state: InheritanceTaxCode
  beneficiaryType: 'lineal' | 'sibling' | 'other'
  inheritanceAmount: number
  taxRate: number
  taxDue: number
  notes: string
}

const INHERITANCE_RATES: Record<InheritanceTaxCode, {
  lineal: number; sibling: number; other: number; notes: string
}> = {
  PA: { lineal: 0.045, sibling: 0.12, other: 0.15, notes: 'Spouses and minor children exempt' },
  NJ: { lineal: 0, sibling: 0.11, other: 0.15, notes: 'Lineal heirs exempt as of 2018' },
  KY: { lineal: 0, sibling: 0.04, other: 0.06, notes: 'Lineal heirs fully exempt' },
  NE: { lineal: 0.01, sibling: 0.13, other: 0.18, notes: 'Rates vary by relationship and amount' },
  IA: { lineal: 0, sibling: 0, other: 0, notes: 'Fully repealed as of Jan 1 2025' },
  MD: { lineal: 0, sibling: 0.10, other: 0.10, notes: 'Also has separate estate tax' },
}

export function calculateInheritanceTax(params: {
  state: InheritanceTaxCode
  beneficiaryType: 'lineal' | 'sibling' | 'other'
  inheritanceAmount: number
  year?: number
}): InheritanceTaxResult {
  const { state, beneficiaryType, inheritanceAmount, year = 2026 } = params
  const rates = INHERITANCE_RATES[state]

  // Iowa fully repealed 2025+
  const taxRate = (state === 'IA' && year >= 2025) ? 0 : rates[beneficiaryType]
  const taxDue = Math.round(inheritanceAmount * taxRate)

  return {
    state,
    beneficiaryType,
    inheritanceAmount,
    taxRate,
    taxDue,
    notes: rates.notes,
  }
}

// ── STATE_REGISTRY (kept for UI badge/label lookups) ─────────────────────────
export const STATE_HAS_ESTATE_TAX: Record<string, boolean> = {
  WA: true, NY: true, MA: true, OR: true, CT: true,
  AZ: false, FL: false, TX: false, NV: false, SD: false,
}

export const STATE_SPECIAL_RULES = SPECIAL_RULES
export const STATE_NAMES_MAP = STATE_NAMES

/** Display name for advisor UI: modeled state name, or profile state when code is `other`. */
export function getEstateTaxDisplayStateName(
  parsedCode: StateTaxCode,
  profileStateAbbrev: string | null | undefined
): string {
  if (parsedCode !== 'other') return STATE_NAMES[parsedCode]
  const ab = profileStateAbbrev?.trim().toUpperCase()
  if (ab && US_STATE_POSTAL_TO_NAME[ab]) return US_STATE_POSTAL_TO_NAME[ab]
  return STATE_NAMES.other
}

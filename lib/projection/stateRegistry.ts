// Sprint 66+ cleanup:
// This file now focuses on state display helpers and inheritance-tax helpers.
// Estate tax calculation has been migrated to lib/calculations/stateEstateTax.ts.

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

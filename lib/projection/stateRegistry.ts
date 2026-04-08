// lib/projection/stateRegistry.ts
// Sprint 64 - State Tax Engine Extension + Situs Tracker
// Registry of state estate tax rules for WA, MA, OR, NY, CT, AZ
// All exemption amounts in dollars. Rates in decimal (0.10 = 10%).

export type StateTaxCode = 'WA' | 'MA' | 'OR' | 'NY' | 'CT' | 'AZ' | 'other'

const KNOWN_STATE_TAX_CODES = new Set<string>(['WA', 'MA', 'OR', 'NY', 'CT', 'AZ'])

/** Map household domicile (2-letter code) to registry codes; unknown → other */
export function parseStateTaxCode(raw: string | null | undefined): StateTaxCode {
  const c = (raw ?? '').trim().toUpperCase()
  return KNOWN_STATE_TAX_CODES.has(c) ? (c as StateTaxCode) : 'other'
}

export interface StateExemptionRow {
  year: number
  exemption: number          // per-person exemption in dollars
  topRate: number            // top marginal rate (decimal)
  hasPortability: boolean    // WA = false, others vary
  hasSunset: boolean         // mirrors federal sunset where applicable
  notes?: string
}

export interface StateRuleSet {
  code: StateTaxCode
  name: string
  hasEstateTax: boolean
  exemptionSchedule: StateExemptionRow[]
  specialRules?: string[]
}

// ── Washington State ─────────────────────────────────────────────────────────
// WA has no portability. Exemption is indexed to inflation (approx 2%/yr).
// Sunset does not apply (WA is independent of federal).
const WA_BASE_EXEMPTION = 2_193_000  // 2024 base
const WA_INFLATION = 0.02

function waExemptionForYear(year: number): number {
  const yearsFromBase = Math.max(0, year - 2024)
  return Math.round(WA_BASE_EXEMPTION * Math.pow(1 + WA_INFLATION, yearsFromBase))
}

// ── New York ─────────────────────────────────────────────────────────────────
// NY cliff: if estate > 105% of exemption, the ENTIRE estate is taxable (no exemption).
// NY exemption tracks federal basic exclusion amount but is capped.
const NY_EXEMPTION_2024 = 6_940_000

function nyExemptionForYear(year: number): number {
  // NY exemption grows at ~3% per year, uncapped from federal
  const yearsFromBase = Math.max(0, year - 2024)
  return Math.round(NY_EXEMPTION_2024 * Math.pow(1.03, yearsFromBase))
}

// ── Massachusetts ─────────────────────────────────────────────────────────────
// MA exemption: $2M flat (no inflation indexing as of 2024 reform).
// MA has a "cliff" at the floor: estate above $2M taxed on full amount above $0...
// actually MA now uses a true exemption (2023 reform). Rate: 0.8% - 16%.
const MA_EXEMPTION = 2_000_000

// ── Oregon ───────────────────────────────────────────────────────────────────
// OR exemption: $1M flat, no portability, rate 10%-16%.
const OR_EXEMPTION = 1_000_000

// ── Connecticut ──────────────────────────────────────────────────────────────
// CT unified gift+estate tax. Exemption matches federal (post-2023).
// CT has a $15M cap on tax liability (unique rule).
const CT_EXEMPTION_2024 = 12_920_000  // tracks federal

function ctExemptionForYear(_year: number, federalExemption: number): number {
  // CT now mirrors federal exemption
  return federalExemption
}

// ── Arizona ──────────────────────────────────────────────────────────────────
// AZ has NO state estate tax. Used as a comparison/move target.

// ── State Registry ────────────────────────────────────────────────────────────
export const STATE_REGISTRY: Record<StateTaxCode, StateRuleSet> = {
  WA: {
    code: 'WA',
    name: 'Washington',
    hasEstateTax: true,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      waExemptionForYear(year),
      topRate:        0.20,
      hasPortability: false,
      hasSunset:      false,
      notes:          'Inflation-indexed ~2%/yr. No portability.',
    })),
    specialRules: ['no_portability', 'inflation_indexed'],
  },

  NY: {
    code: 'NY',
    name: 'New York',
    hasEstateTax: true,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      nyExemptionForYear(year),
      topRate:        0.16,
      hasPortability: false,
      hasSunset:      false,
      notes:          'Cliff applies if estate > 105% of exemption.',
    })),
    specialRules: ['ny_cliff', 'no_portability'],
  },

  MA: {
    code: 'MA',
    name: 'Massachusetts',
    hasEstateTax: true,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      MA_EXEMPTION,
      topRate:        0.16,
      hasPortability: false,
      hasSunset:      false,
      notes:          '$2M flat exemption (2023 reform). No inflation indexing.',
    })),
    specialRules: ['no_portability', 'flat_exemption'],
  },

  OR: {
    code: 'OR',
    name: 'Oregon',
    hasEstateTax: true,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      OR_EXEMPTION,
      topRate:        0.16,
      hasPortability: false,
      hasSunset:      false,
      notes:          '$1M flat exemption. Lowest threshold of any state.',
    })),
    specialRules: ['no_portability', 'flat_exemption', 'low_threshold'],
  },

  CT: {
    code: 'CT',
    name: 'Connecticut',
    hasEstateTax: true,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      CT_EXEMPTION_2024,   // simplified; update with federal schedule
      topRate:        0.12,
      hasPortability: true,
      hasSunset:      true,
      notes:          'Tracks federal exemption. $15M lifetime tax cap.',
    })),
    specialRules: ['tracks_federal', 'ct_tax_cap'],
  },

  AZ: {
    code: 'AZ',
    name: 'Arizona',
    hasEstateTax: false,
    exemptionSchedule: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(year => ({
      year,
      exemption:      Infinity,
      topRate:        0,
      hasPortability: true,
      hasSunset:      false,
      notes:          'No state estate tax.',
    })),
    specialRules: [],
  },

  other: {
    code: 'other',
    name: 'Other / No State Tax',
    hasEstateTax: false,
    exemptionSchedule: [],
    specialRules: [],
  },
}

// ── Primary exported function ─────────────────────────────────────────────────

/**
 * Get the state estate tax exemption for a given state and year.
 * Returns Infinity for states with no estate tax.
 */
export function getStateExemptionForYear(
  stateCode: StateTaxCode,
  year: number,
  federalExemption?: number
): number {
  const ruleset = STATE_REGISTRY[stateCode]
  if (!ruleset || !ruleset.hasEstateTax) return Infinity

  // CT uses federal exemption
  if (stateCode === 'CT' && federalExemption) {
    return ctExemptionForYear(year, federalExemption)
  }

  // WA: compute dynamically
  if (stateCode === 'WA') return waExemptionForYear(year)

  // NY: compute dynamically
  if (stateCode === 'NY') return nyExemptionForYear(year)

  // Find from schedule (MA, OR have flat exemptions)
  const row = ruleset.exemptionSchedule.find(r => r.year === year)
  if (row) return row.exemption

  // Fallback: use most recent year
  const sorted = [...ruleset.exemptionSchedule].sort((a, b) => b.year - a.year)
  return sorted[0]?.exemption ?? Infinity
}

/**
 * Calculate state estate tax for a given gross estate, state, and year.
 * Handles NY cliff rule, WA no-portability, MA/OR flat exemptions.
 */
export function calculateStateEstateTax(params: {
  grossEstate:       number
  stateCode:         StateTaxCode
  year:              number
  federalExemption?: number
  dsue?:             number        // only relevant for states with portability
}): {
  stateTax:         number
  exemptionUsed:    number
  taxableEstate:    number
  nyCliffTriggered: boolean
  effectiveRate:    number
} {
  const { grossEstate, stateCode, year, federalExemption, dsue = 0 } = params

  const ruleset = STATE_REGISTRY[stateCode]

  if (!ruleset?.hasEstateTax || grossEstate <= 0) {
    return { stateTax: 0, exemptionUsed: 0, taxableEstate: 0, nyCliffTriggered: false, effectiveRate: 0 }
  }

  const baseExemption = getStateExemptionForYear(stateCode, year, federalExemption)
  const portabilityApplies = ruleset.exemptionSchedule[0]?.hasPortability ?? false
  const effectiveExemption = portabilityApplies ? baseExemption + dsue : baseExemption

  let taxableEstate  = 0
  let nyCliffTriggered = false

  // NY cliff: if estate > 105% of exemption, no exemption applies
  if (stateCode === 'NY') {
    const cliffThreshold = effectiveExemption * 1.05
    if (grossEstate > cliffThreshold) {
      taxableEstate    = grossEstate   // entire estate taxable
      nyCliffTriggered = true
    } else {
      taxableEstate = Math.max(0, grossEstate - effectiveExemption)
    }
  } else {
    taxableEstate = Math.max(0, grossEstate - effectiveExemption)
  }

  if (taxableEstate <= 0) {
    return { stateTax: 0, exemptionUsed: effectiveExemption, taxableEstate: 0, nyCliffTriggered, effectiveRate: 0 }
  }

  // Simplified progressive rate — use top rate as flat for now
  // (Full bracket tables to be added in Sprint 66 validation)
  const row = ruleset.exemptionSchedule.find(r => r.year === year)
    ?? ruleset.exemptionSchedule[ruleset.exemptionSchedule.length - 1]
  const topRate = row?.topRate ?? 0.16

  // Approximate: blended rate averages ~60% of top rate for typical estates
  const blendedRate = topRate * 0.65
  let stateTax = taxableEstate * blendedRate

  // CT $15M lifetime cap
  if (stateCode === 'CT') {
    stateTax = Math.min(stateTax, 15_000_000)
  }

  const effectiveRate = grossEstate > 0 ? stateTax / grossEstate : 0

  return {
    stateTax:         Math.round(stateTax),
    exemptionUsed:    effectiveExemption,
    taxableEstate:    Math.round(taxableEstate),
    nyCliffTriggered,
    effectiveRate,
  }
}

/**
 * Generate year-by-year state tax for a projection range.
 */
export function getYearByYearStateTax(params: {
  grossEstateByYear: Record<number, number>
  stateCode:         StateTaxCode
  federalExemption?: number
  dsue?:             number
}): Record<number, ReturnType<typeof calculateStateEstateTax>> {
  const { grossEstateByYear, stateCode, federalExemption, dsue } = params
  const result: Record<number, ReturnType<typeof calculateStateEstateTax>> = {}

  for (const [yearStr, grossEstate] of Object.entries(grossEstateByYear)) {
    const year = Number(yearStr)
    result[year] = calculateStateEstateTax({ grossEstate, stateCode, year, federalExemption, dsue })
  }

  return result
}

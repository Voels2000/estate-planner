// ProjectionScenario TypeScript type — immutable once saved (Sprint 57)
// Used by the projection engine (Sprint 59) and all downstream strategy modules.

export type ScenarioType =
  | 'base_case'
  | 'current_law_extended'
  | 'sunset_2026'
  | 'legislative_change'
  | 'custom'

export type ScenarioStatus = 'draft' | 'saved' | 'archived'

export type TaxBracket = {
  min: number
  max: number | null // null = no ceiling (top bracket)
  rate: number // percentage e.g. 37 not 0.37
}

export type AssumptionSnapshot = {
  // Household inputs at time of calculation
  person1_birth_year: number | null
  person1_retirement_age: number | null
  person1_ss_claiming_age: number | null
  person1_longevity_age: number | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  person2_longevity_age: number | null
  has_spouse: boolean
  filing_status: string
  state_primary: string | null
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number
  // Tax config snapshot
  tax_scenario: ScenarioType
  estate_exemption_individual: number
  estate_exemption_married: number
  estate_top_rate_pct: number
  annual_gift_exclusion: number
  // Asset totals at time of calculation
  total_assets: number
  total_liabilities: number
  // Calculated at
  calculated_at: string // ISO timestamp
}

export type AnnualOutput = {
  year: number
  age_person1: number
  age_person2: number | null
  // Income
  income_total: number
  income_earned_p1: number
  income_earned_p2: number
  income_ss_person1: number
  income_ss_person2: number
  income_rmd_p1: number
  income_rmd_p2: number
  income_other_p1: number
  income_other_p2: number
  income_other_pooled: number
  // Tax
  tax_federal: number
  tax_state: number
  tax_capital_gains: number
  tax_niit: number
  tax_payroll: number
  tax_total: number
  // Expenses
  expenses_total: number
  // Assets
  assets_total: number
  assets_p1_total: number
  assets_p2_total: number
  // Estate snapshot
  estate_excl_home: number
  estate_incl_home: number
  estate_tax_federal: number // computed from federal_tax_config (Sprint 59)
  estate_tax_state: number // from calculate_state_estate_tax RPC
  net_to_heirs: number // estate_incl_home - estate_tax_federal - estate_tax_state
  // Assumptions carried on each row (Sprint 57 requirement)
  assumption_snapshot: AssumptionSnapshot
}

export type ProjectionScenario = {
  id: string
  household_id: string
  created_by: string
  label: string
  version: number
  scenario_type: ScenarioType
  assumption_snapshot: AssumptionSnapshot
  outputs: AnnualOutput[]
  outputs_s1_first: AnnualOutput[] | null // person 1 dies first sequence
  outputs_s2_first: AnnualOutput[] | null // person 2 dies first sequence
  status: ScenarioStatus
  calculated_at: string | null
  created_at: string
  updated_at: string
}

// Helper: create an empty assumption snapshot for draft scenarios
export function emptyAssumptionSnapshot(
  taxScenario: ScenarioType = 'current_law_extended'
): AssumptionSnapshot {
  return {
    person1_birth_year: null,
    person1_retirement_age: null,
    person1_ss_claiming_age: null,
    person1_longevity_age: null,
    person2_birth_year: null,
    person2_retirement_age: null,
    person2_ss_claiming_age: null,
    person2_longevity_age: null,
    has_spouse: false,
    filing_status: 'single',
    state_primary: null,
    inflation_rate: 2.5,
    growth_rate_accumulation: 7,
    growth_rate_retirement: 5,
    tax_scenario: taxScenario,
    estate_exemption_individual: 13610000,
    estate_exemption_married: 27220000,
    estate_top_rate_pct: 40,
    annual_gift_exclusion: 18000,
    total_assets: 0,
    total_liabilities: 0,
    calculated_at: new Date().toISOString(),
  }
}

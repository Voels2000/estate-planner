export type ProjectionYear = {
  age: number
  year: number
  income: number
  expenses: number
  taxes: number
  net: number
  portfolio: number
  net_worth: number
  phase: 'accumulation' | 'retirement'
  income_ss_person1: number
  income_ss_person2: number
  income_rmd_p1: number
  income_rmd_p2: number
  income_earned_p1: number
  income_earned_p2: number
  income_other_p1: number
  income_other_p2: number
  income_other_pooled: number
  age_person1: number
  age_person2: number | null
}

export type HouseholdProjectionProfile = {
  id: string
  person1_name: string
  person1_birth_year: number
  person1_retirement_age: number
  person1_longevity_age: number
  person2_name: string | null
  person2_birth_year: number | null
  has_spouse: boolean
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number
  state_primary: string
  filing_status: string
  deduction_mode: 'standard' | 'custom' | 'none'
  custom_deduction_amount: number
}

export type ProjectionApiRow = {
  year: number
  age_person1: number
  age_person2?: number | null
  income_total: number
  expenses_total: number
  tax_total: number
  assets_p1_total?: number | null
  assets_p2_total?: number | null
  assets_pooled_total?: number | null
  net_worth?: number | null
  income_ss_person1?: number | null
  income_ss_person2?: number | null
  income_rmd_p1?: number | null
  income_rmd_p2?: number | null
  income_earned_p1?: number | null
  income_earned_p2?: number | null
  income_other_p1?: number | null
  income_other_p2?: number | null
  income_other_pooled?: number | null
}

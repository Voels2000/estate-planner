export interface StateBracket {
  min: number
  max: number | null
  rate_pct: number
  base_tax: number
}

export interface StateQuirk {
  label: string
  description: string
}

export interface StateEstateTaxData {
  id: string
  state_code: string
  state_name: string
  exemption_amount: number
  exemption_indexed: boolean
  top_rate_pct: number
  portability: boolean
  has_cliff_effect: boolean
  law_effective_date: string
  last_reviewed: string
  review_notes: string | null
  brackets: StateBracket[]
  quirks: StateQuirk[]
  scenario_estate_value: number | null
  scenario_tax_no_plan: number | null
  scenario_tax_with_plan: number | null
  scenario_notes: string | null
  updated_at: string
  updated_by: string | null
}

export type StalenessLevel = 'current' | 'review_due' | 'overdue'

export function getStaleness(lastReviewed: string): StalenessLevel {
  const days = Math.floor(
    (Date.now() - new Date(lastReviewed).getTime()) / (1000 * 60 * 60 * 24),
  )
  if (days < 180) return 'current'
  if (days < 365) return 'review_due'
  return 'overdue'
}

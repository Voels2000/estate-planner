// lib/estate/types.ts
// Shared types for the estate composition layer.
// These mirror the JSON returned by calculate_estate_composition RPC.

export type ConfidenceLevel = 'certain' | 'probable' | 'illustrative'

export type ExclusionType =
  | 'excluded_irrevocable'
  | 'excluded_gifted'
  | 'excluded_other'

export type OutsideStructureItem = {
  name: string
  value: number
  asset_class: 'financial' | 'real_estate' | 'business' | 'insurance'
  exclusion_type: ExclusionType
}

export type OutsideStrategyItem = {
  strategy_source: string
  category: string
  amount: number
  confidence_level: ConfidenceLevel
  effective_year: number | null
  metadata: Record<string, unknown>
}

export type EstateComposition = {
  success: boolean
  error?: string

  // Household context
  filing_status: string
  has_spouse: boolean

  // Inside bucket — totals
  inside_total: number
  inside_financial: number
  inside_financial_liquid: number
  inside_financial_illiquid: number
  inside_real_estate: number
  inside_business_gross: number
  inside_business_taxable: number
  inside_insurance: number
  inside_liquid: number
  inside_illiquid: number

  // Outside — completed structural transfers
  outside_structure_total: number
  outside_structure_items: OutsideStructureItem[]

  // Outside — advisor-recommended strategies (planned, not yet executed)
  outside_strategy_total: number
  outside_strategy_items: OutsideStrategyItem[]

  // Three-tier metrics
  gross_estate: number
  total_liabilities: number
  net_estate: number
  admin_expense: number
  admin_expense_pct: number
  valuation_discount_total: number
  marital_deduction: number
  adjusted_taxable_gifts: number
  taxable_estate: number

  // Exemption
  exemption_available: number
  exemption_remaining: number
  estimated_tax: number
}

// ── Strategy line item types ──────────────────────────────────────────────────

export type StrategyLineItemCategory =
  | 'liability'
  | 'valuation_discount'
  | 'trust_exclusion'
  | 'gifting'
  | 'marital'
  | 'charitable'
  | 'admin_expense'
  | 'adjusted_taxable_gift'

export type StrategyLineItemSource =
  | 'cst'
  | 'ilit'
  | 'annual_gifting'
  | 'lifetime_gifting'
  | 'grat'
  | 'crt'
  | 'clat'
  | 'daf'
  | 'revocable_trust'
  | 'valuation_discount'
  | 'admin_expense'
  | 'marital_deduction'
  | 'adjusted_taxable_gift'
  | 'other'

export type StrategyLineItemInput = {
  household_id: string
  scenario_id?: string
  projection_year?: number | null
  metric_target: 'gross_estate' | 'net_estate' | 'taxable_estate'
  category: StrategyLineItemCategory
  strategy_source: StrategyLineItemSource
  amount: number
  sign?: -1 | 1
  confidence_level?: ConfidenceLevel
  effective_year?: number | null
  metadata?: Record<string, unknown>
}

export type StrategyLineItem = StrategyLineItemInput & {
  id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

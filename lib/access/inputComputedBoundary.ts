/**
 * Authoritative input vs computed boundary (tier restructure PR 2).
 *
 * Governing principle: all data entry is free (Tier 0); computed readouts are paid.
 * PR 6 free export must use EXPORT_INPUT_TABLES — do not invent a parallel list.
 *
 * @see docs/INPUT_COMPUTED_BOUNDARY.md
 */

import { FEATURE_TIERS, type FeatureTier } from '@/lib/tiers'

/** Feature keys for computed analysis surfaced on shared data-entry pages. */
export const COMPUTED_ANALYSIS_FEATURES = {
  'insurance-gap-analysis': 2,
  'real-estate-analysis': 2,
  'business-succession-analysis': 3,
} as const satisfies Record<string, FeatureTier>

export type ComputedAnalysisFeature = keyof typeof COMPUTED_ANALYSIS_FEATURES

/** Household tables included in free portability export (inputs only). */
export const EXPORT_INPUT_TABLES = [
  'households',
  'assets',
  'liabilities',
  'income',
  'expenses',
  'insurance_policies',
  'real_estate',
  'businesses',
] as const

export type ExportInputTable = (typeof EXPORT_INPUT_TABLES)[number]

/**
 * Explicit denylist for PR 6 export — never serialize computed artifacts.
 * Distinct from PAGE_INPUT_COMPUTED_SPLIT: those are runtime derivations from
 * EXPORT_INPUT_TABLES rows; this list is persisted engine/cache outputs.
 */
export const EXPORT_COMPUTED_DENYLIST = [
  'projections',
  'projection_rows',
  'monte_carlo_summaries',
  'estate_composition_cache',
  'health_scores',
  'strategy_line_items',
  'generated_pdfs',
  'beneficiary_conflicts',
] as const

/**
 * Per-page split: fields users type (Tier 0) vs derived readouts (paid).
 * UI gates use computedFeature → COMPUTED_ANALYSIS_FEATURES (via hasFeatureAccess).
 * PR 6 export serializes inputs from EXPORT_INPUT_TABLES only.
 */
export const PAGE_INPUT_COMPUTED_SPLIT = {
  insurance: {
    inputs: [
      'policy metadata (type, provider, owner)',
      'coverage_amount',
      'death_benefit',
      'cash_value',
      'premiums',
      'ILIT / estate inclusion flags',
    ],
    computed: ['insurance-gap-analysis (life, disability, LTC, P&C gap panel)'],
    computedFeature: 'insurance-gap-analysis' as ComputedAnalysisFeature,
  },
  'real-estate': {
    inputs: [
      'property name / type',
      'current_value',
      'mortgage_balance',
      'purchase_price / year',
      'titling / situs_state',
      'planned_sale_year',
      'selling_costs_pct',
    ],
    computed: [
      'portfolio summary cards (total equity, net proceeds)',
      'per-row equity and net proceeds',
      'Section 121 exclusion banner',
    ],
    computedFeature: 'real-estate-analysis' as ComputedAnalysisFeature,
  },
  businesses: {
    inputs: [
      'name / entity_type / ownership_pct',
      'estimated_value / valuation_method',
      'ebitda / valuation_multiple / discount_pct',
      'buy-sell / key-person flags',
      'succession_plan selection',
    ],
    computed: ['business-succession-analysis (/business-succession module)'],
    computedFeature: 'business-succession-analysis' as ComputedAnalysisFeature,
  },
} as const

/** Ensure data-entry FEATURE_TIERS keys stay at Tier 0. */
export const TIER_ZERO_DATA_ENTRY_FEATURES = [
  'profile',
  'assets',
  'liabilities',
  'income',
  'expenses',
  'businesses',
  'property-casualty',
  'insurance',
  'net-worth-view',
  'data-export',
] as const

export function minTierForComputedAnalysis(feature: ComputedAnalysisFeature): FeatureTier {
  return COMPUTED_ANALYSIS_FEATURES[feature]
}

export function assertDataEntryFeaturesAtTierZero(): void {
  for (const key of TIER_ZERO_DATA_ENTRY_FEATURES) {
    const tier = FEATURE_TIERS[key]
    if (tier !== 0) {
      throw new Error(`FEATURE_TIERS.${key} must be 0 (data entry), got ${tier}`)
    }
  }
}

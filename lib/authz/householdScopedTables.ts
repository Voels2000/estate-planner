/**
 * Public tables with a `household_id` column — must have RLS + policies (see assert-rls-coverage.sql).
 * Keep in sync with scripts/verify-rls-invariants.sql check `household_id_table_missing_rls`.
 *
 * Note: core financial rows (`assets`, `liabilities`, etc.) use `owner_id`; behavioral RLS
 * checks those separately in runRlsVerification.ts.
 */
export const HOUSEHOLD_SCOPED_TABLES = [
  'household_people',
  'gift_history',
  'adjusted_taxable_gifts',
  'strategy_line_items',
  'strategy_configs',
  'projection_scenarios',
  'estate_health_scores',
  'estate_health_check',
  'estate_composition_cache',
  'household_alerts',
  'beneficiary_conflicts',
  'digital_assets',
  'gst_ledger',
  'liquidity_analysis',
  'monte_carlo_results',
  'domicile_schedule',
  'legal_documents',
  'ingestion_jobs',
  'attorney_notes',
  'attorney_document_requests',
  'document_gap_dismissals',
] as const

export type HouseholdScopedTable = (typeof HOUSEHOLD_SCOPED_TABLES)[number]

/** High-value subset for docs / quick smoke references (verify:rls checks all HOUSEHOLD_SCOPED_TABLES). */
export const HOUSEHOLD_SCOPED_RLS_SPOT_CHECK: readonly HouseholdScopedTable[] = [
  'gift_history',
  'strategy_line_items',
  'estate_health_scores',
  'estate_composition_cache',
  'household_alerts',
  'projection_scenarios',
  'legal_documents',
]

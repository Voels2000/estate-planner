import type { createClient } from '@/lib/supabase/server'
import type { StrategyLineItemCategory } from '@/lib/estate/types'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type DbConfidenceLevel = 'certain' | 'probable' | 'illustrative'

export const ALLOWED_STRATEGY_SOURCES = [
  'cst',
  'ilit',
  'annual_gifting',
  'lifetime_gifting',
  'grat',
  'crt',
  'clat',
  'daf',
  'revocable_trust',
  'valuation_discount',
  'admin_expense',
  'marital_deduction',
  'other',
  'liquidity',
  'roth',
  'slat',
] as const

export function isAllowedStrategySource(value: string): boolean {
  return (ALLOWED_STRATEGY_SOURCES as readonly string[]).includes(value)
}

/** Maps advisor UI confidence labels to DB enum values. */
export function mapAdvisorConfidenceLevel(
  raw: string | undefined,
): DbConfidenceLevel {
  if (raw === 'high' || raw === 'certain') return 'certain'
  if (raw === 'medium' || raw === 'probable') return 'probable'
  if (raw === 'low' || raw === 'illustrative') return 'illustrative'
  return 'illustrative'
}

export type UpsertStrategyLineItemParams = {
  household_id: string
  strategy_source: string
  source_role: 'consumer' | 'advisor'
  category: StrategyLineItemCategory
  amount?: number
  sign?: number
  confidence_level?: DbConfidenceLevel
  effective_year?: number | null
  metadata?: Record<string, unknown>
  scenario_name?: string | null
  scenario_id?: string
  projection_year?: number | null
  metric_target?: 'gross_estate' | 'net_estate' | 'taxable_estate'
  advisor_id?: string | null
}

export async function upsertStrategyLineItem(
  supabase: ServerSupabase,
  params: UpsertStrategyLineItemParams,
) {
  const scenarioNameValue = params.scenario_name ?? null

  const lookupQuery = supabase
    .from('strategy_line_items')
    .select('id')
    .eq('household_id', params.household_id)
    .eq('strategy_source', params.strategy_source)
    .eq('source_role', params.source_role)
    .is('projection_year', null)

  const { data: existing } = await (
    scenarioNameValue !== null
      ? lookupQuery.eq('scenario_name', scenarioNameValue)
      : lookupQuery.is('scenario_name', null)
  ).maybeSingle()

  const rowFields = {
    amount: params.amount ?? 0,
    sign: params.sign ?? -1,
    confidence_level: params.confidence_level ?? 'illustrative',
    effective_year: params.effective_year ?? null,
    metadata: params.metadata ?? {},
    scenario_name: scenarioNameValue,
    is_active: true,
  }

  if (existing?.id) {
    const updateFields = { ...rowFields }
    if (params.advisor_id) {
      Object.assign(updateFields, { advisor_id: params.advisor_id })
    }
    return supabase
      .from('strategy_line_items')
      .update(updateFields)
      .eq('id', existing.id)
      .select()
      .single()
  }

  return supabase
    .from('strategy_line_items')
    .insert({
      household_id: params.household_id,
      scenario_id: params.scenario_id ?? 'current_law',
      projection_year: params.projection_year ?? null,
      metric_target: params.metric_target ?? 'taxable_estate',
      category: params.category,
      strategy_source: params.strategy_source,
      source_role: params.source_role,
      advisor_id: params.advisor_id ?? null,
      consumer_accepted: false,
      consumer_rejected: false,
      ...rowFields,
    })
    .select()
    .single()
}

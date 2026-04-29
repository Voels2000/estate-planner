/**
 * Advisor client workspace data loaders.
 *
 * Fetches household-linked datasets, projection staleness signals, domicile artifacts,
 * and export/supporting data for advisor client tabs.
 */

import { createClient } from '@/lib/supabase/server'
import { loadLatestChangeTs } from '@/lib/dashboard/loaders'
import { getLatestTimestampMs, isProjectionStale } from '@/lib/projections/staleness'
import { detectConflicts } from '@/lib/conflict-detector'
import {
  fetchActiveStrategies,
  fetchActionItems,
  fetchAdvisorDisplayName,
  fetchHealthScore,
  fetchLiquidAssets,
  fetchMonteCarloSummary,
  fetchScenarioHistoryForExport,
} from '@/lib/export-wiring'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type AdvisorClientDatasetsResult = {
  assetsResult: { data: unknown[] | null; error?: unknown }
  realEstateResult: { data: unknown[] | null; error?: unknown }
  beneficiariesResult: { data: unknown[] | null; error?: unknown }
  estateDocumentsResult: { data: unknown[] | null; error?: unknown }
  legalDocumentsResult: { data: unknown[] | null; error?: unknown }
  notesResult: { data: unknown[] | null; error?: unknown }
  estateTaxResult: { data: unknown | null; error?: unknown }
  scenarioResult: { data: Record<string, unknown> | null; error: unknown | null }
  domicileAnalysisResult: { data: Record<string, unknown> | null; error?: unknown }
  domicileScheduleResult: { data: unknown[] | null; error?: unknown }
  businessesResult: { data: unknown[] | null; error?: unknown }
  liabilitiesResult: { data: unknown[] | null; error?: unknown }
  businessInterestsResult: { data: unknown[] | null; error?: unknown }
  insurancePoliciesResult: { data: unknown[] | null; error?: unknown }
  stateExemptionsResult: { data: unknown[] | null; error?: unknown }
  stateBracketsResult: { data: unknown[] | null; error?: unknown }
  stateTaxRulesAllYearsResult: { data: unknown[] | null; error?: unknown }
  stateIncomeTaxBracketsResult: { data: unknown[] | null; error?: unknown }
  strategyLineItemsResult: { data: unknown[] | null; error?: unknown }
  healthScore: number | null
  liquidAssets: number
  activeStrategies: string[]
  actionItems: Array<{ id: string; message: string; severity: string; created_at: string }>
  advisorDisplayName: string
  monteCarloResults: { p10: number; p50: number; p90: number; paths: number } | null
  scenarioHistoryForExport: Array<{ id: string; created_at: string; label: string; gross_estate: number }>
  beneficiaryGrantsResult: { data: unknown[] | null; error?: unknown }
  conflictReport: {
    conflicts: Array<{
      conflict_type: string
      severity: 'critical' | 'warning' | 'info'
      description: string
      recommended_action: string
      asset_id: string | null
      real_estate_id: string | null
    }>
    critical: number
    warnings: number
  } | null
}

export async function loadAdvisorProjectionStaleness(
  supabase: ServerSupabase,
  params: {
    ownerId: string
    baseCaseScenarioId: string | null | undefined
    householdUpdatedAt: string | null | undefined
  },
): Promise<{
  projectionCalculatedAt: string | null
  latestInputChangeMs: number
  isStale: boolean
}> {
  const { data: existingScenario } = params.baseCaseScenarioId
    ? await supabase
        .from('projection_scenarios')
        .select('calculated_at')
        .eq('id', params.baseCaseScenarioId)
        .single()
    : { data: null }

  const projectionCalculatedAt = existingScenario?.calculated_at ?? null

  const [
    assetsChangedAt,
    liabilitiesChangedAt,
    incomeChangedAt,
    expensesChangedAt,
    realEstateChangedAt,
    businessesChangedAt,
    businessInterestsChangedAt,
    insuranceChangedAt,
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  ] = await Promise.all([
    loadLatestChangeTs(supabase, 'assets', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'liabilities', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'income', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'expenses', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'real_estate', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'businesses', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'business_interests', 'owner_id', params.ownerId),
    loadLatestChangeTs(supabase, 'insurance_policies', 'user_id', params.ownerId),
    (async () => {
      const { data } = await supabase
        .from('state_income_tax_brackets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = (data?.[0] ?? null) as { created_at?: string | null } | null
      return row?.created_at ?? null
    })(),
    (async () => {
      const { data } = await supabase
        .from('federal_tax_brackets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = (data?.[0] ?? null) as { created_at?: string | null } | null
      return row?.created_at ?? null
    })(),
  ])

  const latestInputChangeMs = getLatestTimestampMs([
    params.householdUpdatedAt ?? null,
    assetsChangedAt,
    liabilitiesChangedAt,
    incomeChangedAt,
    expensesChangedAt,
    realEstateChangedAt,
    businessesChangedAt,
    businessInterestsChangedAt,
    insuranceChangedAt,
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  ])

  return {
    projectionCalculatedAt,
    latestInputChangeMs,
    isStale: isProjectionStale({
      baseCaseScenarioId: params.baseCaseScenarioId,
      projectionCalculatedAt,
      latestInputChangeMs,
    }),
  }
}

export async function loadAdvisorClientDatasets(
  supabase: ServerSupabase,
  params: {
    clientId: string
    userId: string
    householdId: string
    householdStatePrimary: string | null
    scenarioId: string | null
    statesToFetch: string[]
    projectionYears: number[]
  },
): Promise<AdvisorClientDatasetsResult> {
  const [
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
    estateTaxResult,
    scenarioResult,
    domicileAnalysisResult,
    domicileScheduleResult,
    businessesResult,
    liabilitiesResult,
    businessInterestsResult,
    insurancePoliciesResult,
    stateExemptionsResult,
    stateBracketsResult,
    stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult,
    strategyLineItemsResult,
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    monteCarloResults,
    scenarioHistoryForExport,
    beneficiaryGrantsResult,
    conflictReport,
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, type, value, owner, cost_basis, titling, liquidity, situs_state, created_at')
      .eq('owner_id', params.clientId),
    supabase
      .from('real_estate')
      .select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner')
      .eq('owner_id', params.clientId),
    supabase
      .from('asset_beneficiaries')
      .select(
        'id, full_name, relationship, allocation_pct, beneficiary_type, asset_id, real_estate_id, insurance_policy_id, business_id, created_at',
      )
      .eq('owner_id', params.clientId),
    supabase
      .from('estate_documents')
      .select('id, document_type, exists, confirmed_at, created_at')
      .eq('owner_id', params.clientId),
    supabase
      .from('legal_documents')
      .select('id, document_type, file_name, uploader_role, version, is_current, created_at')
      .eq('household_id', params.householdId)
      .eq('is_current', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('advisor_notes')
      .select('id, content, created_at, updated_at')
      .eq('advisor_id', params.userId)
      .eq('client_id', params.clientId)
      .order('created_at', { ascending: false }),
    supabase.rpc('calculate_state_estate_tax', { p_household_id: params.householdId }),
    params.scenarioId
      ? supabase
          .from('projection_scenarios')
          .select('id, scenario_type, outputs, outputs_s1_first, outputs_s2_first, assumption_snapshot')
          .eq('id', params.scenarioId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('domicile_analysis')
      .select(`
      id, claimed_domicile_state, states,
      drivers_license_state, voter_registration_state,
      vehicle_registration_state, primary_home_titled_state,
      spouse_children_state, estate_docs_declare_state,
      files_taxes_in_state, business_interests_state,
      risk_score, risk_level, dominant_state,
      conflict_states, recommendations,
      created_at, updated_at
    `)
      .eq('user_id', params.clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('domicile_schedule')
      .select('*')
      .eq('household_id', params.householdId)
      .order('effective_year', { ascending: true }),
    supabase
      .from('businesses')
      .select('id, name, entity_type, ownership_pct, estimated_value, owner_estimated_value, valuation_method, has_buy_sell_agreement, buy_sell_funded, has_key_person_insurance, succession_plan, dloc_pct, dlom_pct, estate_inclusion_status')
      .eq('owner_id', params.clientId),
    supabase
      .from('liabilities')
      .select('id, type, balance, owner')
      .eq('owner_id', params.clientId),
    supabase
      .from('business_interests')
      .select('id, entity_name, fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', params.clientId),
    supabase
      .from('insurance_policies')
      .select('id, insurance_type, provider, policy_name, death_benefit, cash_value, annual_premium, is_ilit, is_employer_provided, estate_inclusion_status')
      .eq('user_id', params.clientId),
    supabase.rpc('get_state_exemptions', {
      p_states: params.statesToFetch,
      p_years: params.projectionYears,
    }),
    supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', params.householdStatePrimary ?? '')
      .eq('tax_year', new Date().getFullYear())
      .order('min_amount', { ascending: true }),
    supabase
      .from('state_estate_tax_rules')
      .select('state, tax_year, min_amount, max_amount, rate_pct, exemption_amount')
      .order('tax_year', { ascending: true })
      .order('state', { ascending: true })
      .order('min_amount', { ascending: true }),
    supabase
      .from('state_income_tax_brackets')
      .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true })
      .order('filing_status', { ascending: true })
      .order('min_amount', { ascending: true }),
    supabase
      .from('strategy_line_items')
      .select('id, strategy_source, source_role, amount, sign, confidence_level, effective_year, is_active, consumer_accepted, consumer_rejected')
      .eq('household_id', params.householdId)
      .eq('is_active', true),
    fetchHealthScore(params.householdId),
    fetchLiquidAssets(params.clientId),
    fetchActiveStrategies(params.householdId),
    fetchActionItems(params.householdId),
    fetchAdvisorDisplayName(params.userId),
    params.scenarioId ? fetchMonteCarloSummary(params.scenarioId) : Promise.resolve(null),
    fetchScenarioHistoryForExport(params.householdId),
    supabase
      .from('beneficiary_access_grants')
      .select('*')
      .eq('household_id', params.householdId)
      .order('granted_at', { ascending: false }),
    detectConflicts(params.householdId, params.clientId).catch((e) => {
      console.error('[advisor-client-view] conflict detection failed:', e)
      return null
    }),
  ])

  return {
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
    estateTaxResult,
    scenarioResult,
    domicileAnalysisResult,
    domicileScheduleResult,
    businessesResult,
    liabilitiesResult,
    businessInterestsResult,
    insurancePoliciesResult,
    stateExemptionsResult,
    stateBracketsResult,
    stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult,
    strategyLineItemsResult,
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    monteCarloResults,
    scenarioHistoryForExport,
    beneficiaryGrantsResult,
    conflictReport,
  }
}

export async function loadAdvisorDomicileChecklist(
  supabase: ServerSupabase,
  analysisId: string | null | undefined,
) {
  if (!analysisId) return []
  const { data } = await supabase
    .from('domicile_checklist_items')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('priority', { ascending: false })
  return data ?? []
}

export async function logAdvisorClientAccess(
  supabase: ServerSupabase,
  params: { advisorId: string; clientId: string },
) {
  try {
    await supabase.from('advisor_access_log').insert({
      advisor_id: params.advisorId,
      client_id: params.clientId,
      accessed_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[advisor-client-view] access log failed:', e)
  }
}

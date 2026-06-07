/**
 * Advisor client workspace data loaders.
 *
 * Fetches household-linked datasets, projection staleness signals, domicile artifacts,
 * and export/supporting data for advisor client tabs.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLatestChangeTs } from '@/lib/dashboard/loaders'
import { getLatestTimestampMs, isProjectionStale } from '@/lib/projections/staleness'
import { mapConflictReport } from '@/lib/dashboard/mappers'
import {
  fetchActiveStrategies,
  fetchActionItems,
  fetchAdvisorDisplayName,
  fetchAdvisorProfile,
  fetchHealthScore,
  fetchLiquidAssets,
  fetchMonteCarloSummary,
  fetchScenarioHistoryForExport,
} from '@/lib/export-wiring'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const emptyList = { data: [] as unknown[], error: null as unknown | null }
const emptySingle = {
  data: null as Record<string, unknown> | null,
  error: null as unknown | null,
}

export type AdvisorDatasetInclude = {
  assets: boolean
  realEstate: boolean
  beneficiaries: boolean
  estateDocuments: boolean
  legalDocuments: boolean
  notes: boolean
  scenario: boolean
  domicile: boolean
  businesses: boolean
  liabilities: boolean
  businessInterests: boolean
  insurance: boolean
  stateTax: boolean
  stateIncome: boolean
  strategyLineItems: boolean
  healthScore: boolean
  exportWiring: boolean
  beneficiaryGrants: boolean
  conflictReport: boolean
}

export const ADVISOR_DATASET_INCLUDE_ALL: AdvisorDatasetInclude = {
  assets: true,
  realEstate: true,
  beneficiaries: true,
  estateDocuments: true,
  legalDocuments: true,
  notes: true,
  scenario: true,
  domicile: true,
  businesses: true,
  liabilities: true,
  businessInterests: true,
  insurance: true,
  stateTax: true,
  stateIncome: true,
  strategyLineItems: true,
  healthScore: true,
  exportWiring: true,
  beneficiaryGrants: true,
  conflictReport: true,
}

/** Tab-scoped dataset flags — reduces round trips when a non-overview tab is opened. */
export function advisorDatasetIncludeForTab(tab: string): AdvisorDatasetInclude {
  const core = {
    assets: true,
    realEstate: true,
    beneficiaries: true,
    estateDocuments: true,
  }
  switch (tab) {
    case 'overview':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: false,
        domicile: false,
        businesses: true,
        liabilities: false,
        businessInterests: false,
        insurance: true,
        stateTax: false,
        stateIncome: false,
        strategyLineItems: false,
        healthScore: true,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'retirement':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: true,
        domicile: false,
        businesses: false,
        liabilities: false,
        businessInterests: false,
        insurance: false,
        stateTax: false,
        stateIncome: true,
        strategyLineItems: false,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'notes':
      return {
        assets: false,
        realEstate: false,
        beneficiaries: false,
        estateDocuments: false,
        legalDocuments: false,
        notes: true,
        scenario: false,
        domicile: false,
        businesses: false,
        liabilities: false,
        businessInterests: false,
        insurance: false,
        stateTax: false,
        stateIncome: false,
        strategyLineItems: false,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'documents':
      return {
        assets: false,
        realEstate: false,
        beneficiaries: false,
        estateDocuments: false,
        legalDocuments: true,
        notes: false,
        scenario: false,
        domicile: false,
        businesses: false,
        liabilities: false,
        businessInterests: false,
        insurance: false,
        stateTax: false,
        stateIncome: false,
        strategyLineItems: false,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'domicile':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: true,
        domicile: true,
        businesses: true,
        liabilities: false,
        businessInterests: false,
        insurance: false,
        stateTax: true,
        stateIncome: true,
        strategyLineItems: true,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'tax':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: true,
        domicile: false,
        businesses: false,
        liabilities: false,
        businessInterests: false,
        insurance: false,
        stateTax: true,
        stateIncome: false,
        strategyLineItems: true,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'strategy':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: true,
        domicile: false,
        businesses: true,
        liabilities: false,
        businessInterests: false,
        insurance: true,
        stateTax: true,
        stateIncome: false,
        strategyLineItems: false,
        healthScore: false,
        exportWiring: true,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    case 'estate':
      return {
        ...core,
        legalDocuments: false,
        notes: false,
        scenario: true,
        domicile: false,
        businesses: true,
        liabilities: true,
        businessInterests: true,
        insurance: true,
        stateTax: true,
        stateIncome: false,
        strategyLineItems: true,
        healthScore: false,
        exportWiring: false,
        beneficiaryGrants: true,
        conflictReport: true,
      }
    case 'meeting-prep':
      return {
        ...core,
        legalDocuments: false,
        notes: true,
        scenario: true,
        domicile: false,
        businesses: true,
        liabilities: false,
        businessInterests: false,
        insurance: true,
        stateTax: true,
        stateIncome: false,
        strategyLineItems: true,
        healthScore: true,
        exportWiring: true,
        beneficiaryGrants: false,
        conflictReport: false,
      }
    default:
      return ADVISOR_DATASET_INCLUDE_ALL
  }
}

export async function loadAdvisorGapStatuses(
  supabase: ServerSupabase,
  params: { advisorId: string; clientId: string },
): Promise<Record<string, { status: string; note: string | null }>> {
  const { data, error } = await supabase
    .from('advisor_gap_statuses')
    .select('gap_key, status, note')
    .eq('advisor_id', params.advisorId)
    .eq('client_id', params.clientId)

  if (error) {
    console.error('[advisor-client] gap statuses load failed:', error)
    return {}
  }

  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.gap_key,
      { status: row.status, note: row.note },
    ]),
  )
}

export type AdvisorClientDatasetsResult = {
  assetsResult: { data: unknown[] | null; error?: unknown }
  realEstateResult: { data: unknown[] | null; error?: unknown }
  beneficiariesResult: { data: unknown[] | null; error?: unknown }
  estateDocumentsResult: { data: unknown[] | null; error?: unknown }
  legalDocumentsResult: { data: unknown[] | null; error?: unknown }
  notesResult: { data: unknown[] | null; error?: unknown }
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
  healthScoreComputedAt: string | null
  healthScoreComponents: Array<{ label: string; score: number; maxScore: number }>
  liquidAssets: number
  activeStrategies: string[]
  actionItems: Array<{ id: string; message: string; severity: string; created_at: string }>
  advisorDisplayName: string
  advisorProfile: Awaited<ReturnType<typeof fetchAdvisorProfile>>
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
    /** Skip global tax-table timestamps (saves 2 round trips on advisor client load). */
    skipGlobalTaxTableStaleness?: boolean
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
    params.skipGlobalTaxTableStaleness
      ? Promise.resolve(null)
      : (async () => {
          const { data } = await supabase
            .from('state_income_tax_brackets')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
          const row = (data?.[0] ?? null) as { created_at?: string | null } | null
          return row?.created_at ?? null
        })(),
    params.skipGlobalTaxTableStaleness
      ? Promise.resolve(null)
      : (async () => {
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
    include?: AdvisorDatasetInclude
  },
): Promise<AdvisorClientDatasetsResult> {
  const inc = params.include ?? ADVISOR_DATASET_INCLUDE_ALL
  const admin = createAdminClient()

  const stateFilter = [
    ...new Set(
      [...params.statesToFetch, params.householdStatePrimary].filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      ),
    ),
  ]
  const taxYears = [...new Set(params.projectionYears)]
  const currentYear = new Date().getFullYear()

  let fetchedStateBracketsResult: { data: unknown[] | null; error?: unknown } = emptyList
  if (inc.stateTax) {
    fetchedStateBracketsResult = await supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', params.householdStatePrimary ?? '')
      .eq('tax_year', currentYear)
      .order('min_amount', { ascending: true })

    if ((fetchedStateBracketsResult.data ?? []).length === 0) {
      fetchedStateBracketsResult = await supabase
        .from('state_estate_tax_rules')
        .select('min_amount, max_amount, rate_pct, exemption_amount')
        .eq('state', params.householdStatePrimary ?? '')
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true })
        .limit(20)
    }
  }

  const [
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
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
    healthScoreResult,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
    monteCarloResults,
    scenarioHistoryForExport,
    beneficiaryGrantsResult,
    conflictReport,
  ] = await Promise.all([
    inc.assets
      ? supabase
          .from('assets')
          .select('id, name, type, value, owner, cost_basis, titling, liquidity, situs_state, created_at')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.realEstate
      ? supabase
          .from('real_estate')
          .select('id, name, property_type, current_value, purchase_price, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, situs_state, owner')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.beneficiaries
      ? supabase
          .from('asset_beneficiaries')
          .select(
            'id, full_name, relationship, allocation_pct, beneficiary_type, asset_id, real_estate_id, insurance_policy_id, business_id, created_at',
          )
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.estateDocuments
      ? supabase
          .from('estate_documents')
          .select('id, document_type, exists, confirmed_at, created_at')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.legalDocuments
      ? supabase
          .from('legal_documents')
          .select('id, document_type, file_name, uploader_role, version, is_current, created_at')
          .eq('household_id', params.householdId)
          .eq('is_current', true)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
      : Promise.resolve(emptyList),
    inc.notes
      ? supabase
          .from('advisor_notes')
          .select('id, content, created_at, updated_at')
          .eq('advisor_id', params.userId)
          .eq('client_id', params.clientId)
          .order('created_at', { ascending: false })
      : Promise.resolve(emptyList),
    inc.scenario && params.scenarioId
      ? supabase
          .from('projection_scenarios')
          .select('id, scenario_type, outputs, outputs_s1_first, outputs_s2_first, assumption_snapshot')
          .eq('id', params.scenarioId)
          .single()
      : Promise.resolve(emptySingle),
    inc.domicile
      ? supabase
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
          .maybeSingle()
      : Promise.resolve(emptySingle),
    inc.domicile
      ? supabase
          .from('domicile_schedule')
          .select('*')
          .eq('household_id', params.householdId)
          .order('effective_year', { ascending: true })
      : Promise.resolve(emptyList),
    inc.businesses
      ? supabase
          .from('businesses')
          .select('id, name, entity_type, ownership_pct, estimated_value, owner_estimated_value, valuation_method, has_buy_sell_agreement, buy_sell_funded, has_key_person_insurance, succession_plan, dloc_pct, dlom_pct, estate_inclusion_status')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.liabilities
      ? supabase
          .from('liabilities')
          .select('id, type, balance, owner')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.businessInterests
      ? supabase
          .from('business_interests')
          .select('id, entity_name, fmv_estimated, total_entity_value, ownership_pct')
          .eq('owner_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.insurance
      ? supabase
          .from('insurance_policies')
          .select('id, insurance_type, provider, policy_name, death_benefit, cash_value, annual_premium, is_ilit, is_employer_provided, estate_inclusion_status')
          .eq('user_id', params.clientId)
      : Promise.resolve(emptyList),
    inc.stateTax
      ? supabase.rpc('get_state_exemptions', {
          p_states: params.statesToFetch,
          p_years: params.projectionYears,
        })
      : Promise.resolve(emptyList),
    Promise.resolve(fetchedStateBracketsResult),
    inc.stateTax && stateFilter.length > 0
      ? supabase
          .from('state_estate_tax_rules')
          .select('state, tax_year, min_amount, max_amount, rate_pct, exemption_amount')
          .in('state', stateFilter)
          .in('tax_year', taxYears)
          .order('tax_year', { ascending: true })
          .order('state', { ascending: true })
          .order('min_amount', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    inc.stateIncome && stateFilter.length > 0
      ? supabase
          .from('state_income_tax_brackets')
          .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
          .in('state', stateFilter)
          .in('tax_year', taxYears)
          .order('tax_year', { ascending: false })
          .order('state', { ascending: true })
          .order('filing_status', { ascending: true })
          .order('min_amount', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    inc.strategyLineItems
      ? supabase
          .from('strategy_line_items')
          .select(
            'id, strategy_source, source_role, amount, sign, confidence_level, effective_year, is_active, consumer_accepted, consumer_rejected, consumer_withdrawn, withdrawn_at, reversal_reason, reversed_from',
          )
          .eq('household_id', params.householdId)
          .or('is_active.eq.true,and(consumer_withdrawn.eq.true,is_active.eq.false)')
      : Promise.resolve(emptyList),
    inc.healthScore
      ? fetchHealthScore(params.householdId)
      : Promise.resolve({ score: null, computedAt: null, components: [] }),
    inc.exportWiring ? fetchLiquidAssets(params.clientId) : Promise.resolve(0),
    inc.exportWiring ? fetchActiveStrategies(params.householdId) : Promise.resolve([]),
    inc.exportWiring ? fetchActionItems(params.householdId) : Promise.resolve([]),
    inc.exportWiring ? fetchAdvisorDisplayName(params.userId) : Promise.resolve(''),
    inc.exportWiring ? fetchAdvisorProfile(params.userId) : Promise.resolve({
      full_name: null,
      email: null,
      firm_name: null,
      phone: null,
      firm_logo_url: null,
    }),
    inc.exportWiring && params.scenarioId
      ? fetchMonteCarloSummary(params.scenarioId)
      : Promise.resolve(null),
    inc.exportWiring ? fetchScenarioHistoryForExport(params.householdId) : Promise.resolve([]),
    inc.beneficiaryGrants
      ? supabase
          .from('beneficiary_access_grants')
          .select('*')
          .eq('household_id', params.householdId)
          .order('granted_at', { ascending: false })
      : Promise.resolve(emptyList),
    inc.conflictReport && params.householdId
      ? (async () => {
          try {
            const { data, error } = await admin
              .from('beneficiary_conflicts')
              .select('conflict_type, severity, asset_id, real_estate_id, description, recommended_action')
              .eq('household_id', params.householdId)
            if (error) {
              console.error('[advisor-client-view] conflict cache read failed:', error)
              return null
            }
            return mapConflictReport(data)
          } catch (e) {
            console.error('[advisor-client-view] conflict cache read failed:', e)
            return null
          }
        })()
      : Promise.resolve(null),
  ])

  return {
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult,
    legalDocumentsResult,
    notesResult,
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
    healthScore: healthScoreResult.score,
    healthScoreComputedAt: healthScoreResult.computedAt,
    healthScoreComponents: healthScoreResult.components,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
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

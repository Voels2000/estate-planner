import type { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { buildAdvisorExportPayloads } from '@/lib/advisor/exportMappers'
import { mapAdvisorClientDatasets } from '@/lib/advisor/mappers'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import {
  ADVISOR_DATASET_INCLUDE_ALL,
  loadAdvisorClientDatasets,
} from '@/lib/advisor/loaders'
import type { AssetBeneficiaryRow } from '@/lib/advisor/beneficiaryHelpers'
import { fetchNarrativePdfFields } from '@/lib/export/fetchNarrativePdfFields'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import {
  fetchStrategyLineItemsWithClient,
  strategyLineItemsForHorizons,
} from '@/lib/estate/strategyLedger'
import { buildAdvisorStatesToFetch } from '@/lib/tax/advisorStateFetchScope'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type AdvisorClientExportPayload = {
  exportPanelProps: Awaited<ReturnType<typeof buildAdvisorExportPayloads>>['exportPanelProps']
  exportPdfData: Awaited<ReturnType<typeof buildAdvisorExportPayloads>>['exportPdfData']
  exportExcelData: Awaited<ReturnType<typeof buildAdvisorExportPayloads>>['exportExcelData']
}

/** On-demand export payloads for advisor client workspace (Meeting Prep / Export panel). */
export async function loadAdvisorClientExportPayload(
  supabase: ServerSupabase,
  advisorId: string,
  clientId: string,
): Promise<AdvisorClientExportPayload | null> {
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .eq('client_id', clientId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!link) return null

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', clientId)
    .maybeSingle()

  if (!household) return null

  const currentYear = new Date().getFullYear()
  const projectionYears = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
    currentYear + 4,
    currentYear + 5,
  ]
  const statesToFetch = buildAdvisorStatesToFetch(household.state_primary)
  const scenarioId = household.base_case_scenario_id as string | null

  const include = { ...ADVISOR_DATASET_INCLUDE_ALL, exportWiring: true }

  const [giftingSummaryRes, datasetsBundle, advisorItems, consumerItems] = await Promise.all([
    supabase.rpc('calculate_gifting_summary', { p_household_id: household.id }),
    loadAdvisorClientDatasets(supabase, {
      clientId,
      userId: advisorId,
      householdId: household.id,
      householdStatePrimary: household.state_primary ?? null,
      scenarioId,
      statesToFetch,
      projectionYears,
      include,
    }),
    fetchStrategyLineItemsWithClient(supabase, household.id, 'advisor'),
    fetchStrategyLineItemsWithClient(supabase, household.id, 'consumer'),
  ])

  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummaryRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
        0,
    ) || 0,
  )

  const estateComposition = await getCachedComposition(
    supabase,
    household.id,
    'consumer',
    lifetimeGiftsUsed,
  )

  const federalBrackets = latestFederalBracketsFromRows(
    (
      await supabase
        .from('federal_estate_tax_brackets')
        .select('tax_year, min_amount, max_amount, rate_pct')
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true })
    ).data ?? [],
  )

  const {
    assetsResult,
    realEstateResult,
    beneficiariesResult,
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
    advisorProfile,
    healthScoreComponents,
    monteCarloResults,
    scenarioHistoryForExport,
  } = datasetsBundle

  const mapped = mapAdvisorClientDatasets({
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    estateDocumentsResult: { data: [] },
    legalDocumentsResult: { data: [] },
    notesResult: { data: [] },
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
    beneficiaryGrantsResult: { data: [] },
  })

  const strategyLineItemsForVm = strategyLineItemsForHorizons(advisorItems, consumerItems)

  const strategyVm = buildAdvisorStrategyViewModels({
    currentYear,
    household,
    stateBrackets: mapped.stateBrackets,
    federalBrackets,
    estateCompositionGrossEstate: Number(estateComposition?.gross_estate ?? 0),
    lifetimeGiftsUsed,
    scenario: mapped.scenario,
    scenarioOutputs: mapped.scenarioOutputs,
    scenarioOutputsSecondDeath: mapped.scenarioOutputsSecondDeath,
    latestOutput: mapped.latestOutput,
    assumptionSnapshot: mapped.assumptionSnapshot,
    strategyLineItems: strategyLineItemsForVm,
  })

  const grossForExport = Number(mapped.latestOutput?.estate_incl_home ?? 0)
  const narrativeFields = await fetchNarrativePdfFields({
    householdId: household.id,
    clientId,
    grossEstate: strategyVm.advisorHorizons.today.grossEstate ?? grossForExport,
    filingStatus: household.filing_status,
    statePrimary: household.state_primary,
  })

  return buildAdvisorExportPayloads({
    household,
    scenarioId,
    supabase,
    advisorDisplayName,
    advisorProfile,
    healthScore,
    healthScoreComponents,
    liquidAssets,
    activeStrategies,
    actionItems,
    monteCarloResults,
    scenarioHistoryForExport,
    scenarioOutputs: mapped.scenarioOutputs,
    latestOutput: mapped.latestOutput,
    todayGrossEstate: strategyVm.advisorHorizons.today.grossEstate ?? null,
    assumptionSnapshot: mapped.assumptionSnapshot,
    scenarioForStrategy: strategyVm.scenarioForStrategy,
    narrativeFields,
    stateBrackets: mapped.stateBrackets,
    federalBrackets,
    lifetimeGiftsUsed,
    assets: mapped.assets,
    realEstate: mapped.realEstate,
    beneficiaries: (beneficiariesResult.data ?? []) as AssetBeneficiaryRow[],
    businesses: mapped.businesses,
    businessInterests: mapped.businessInterests,
    insurancePolicies: mapped.insurancePolicies,
    compositionFallback: estateComposition
      ? {
          inside_financial: estateComposition.inside_financial,
          inside_real_estate: estateComposition.inside_real_estate,
          inside_business_gross: estateComposition.inside_business_gross,
          inside_insurance: estateComposition.inside_insurance,
        }
      : null,
  })
}

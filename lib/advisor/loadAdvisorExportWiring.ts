/**
 * Shared server loader for advisor PDF / export panel payloads.
 * Used by the client page and print API routes.
 */

import type { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { mapAdvisorClientDatasets } from '@/lib/advisor/mappers'
import { buildAdvisorExportPayloads } from '@/lib/advisor/exportMappers'
import type { AssetBeneficiaryRow } from '@/lib/advisor/beneficiaryHelpers'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import { fetchNarrativePdfFields } from '@/lib/export/fetchNarrativePdfFields'
import { advisorDatasetIncludeForTab, loadAdvisorClientDatasets } from '@/lib/advisor/loaders'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import type { PDFReportData } from '@/lib/export/generatePDFReport'
import type { ExcelExportData } from '@/lib/export/generateExcelExport'
import type { AdvisorExportPanelProps } from '@/lib/advisor/types'
import { buildAdvisorStatesToFetch } from '@/lib/tax/advisorStateFetchScope'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type MeetingPrepAtDeathSnapshot = {
  grossEstate: number | null
  totalTaxLiability: number | null
  headerTitle: string
}

export type AdvisorExportWiringResult = {
  exportPdfData: PDFReportData
  exportPanelProps: AdvisorExportPanelProps
  exportExcelData: ExcelExportData
  /** Same at-death tax as Strategy tab / Meeting Prep modal (`computeColumnTaxes`). */
  meetingPrepAtDeath: MeetingPrepAtDeathSnapshot | null
}

export async function loadAdvisorExportWiringForClient(
  supabase: ServerSupabase,
  params: { advisorUserId: string; clientId: string },
): Promise<AdvisorExportWiringResult | null> {
  const { advisorUserId, clientId } = params

  const { data: clientAccess } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorUserId)
    .eq('client_id', clientId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!clientAccess) return null

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select(
      'id, owner_id, has_spouse, person1_first_name, person1_last_name, person2_first_name, person2_last_name, state_primary, filing_status, person1_birth_year, person2_birth_year, person1_longevity_age, person2_longevity_age, inflation_rate, growth_rate_accumulation, growth_rate_retirement, base_case_scenario_id, updated_at',
    )
    .eq('owner_id', clientId)
    .maybeSingle()

  if (householdError || !household) return null

  const currentYear = new Date().getFullYear()
  const projectionYears = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
    currentYear + 4,
    currentYear + 5,
  ]
  const statesToFetch = buildAdvisorStatesToFetch(household.state_primary ?? null)
  const scenarioId = household.base_case_scenario_id as string | null
  const include = advisorDatasetIncludeForTab('meeting-prep')

  const giftingSummaryRes = await supabase.rpc('calculate_gifting_summary', {
    p_household_id: household.id,
  })
  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummaryRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0,
    ) || 0,
  )

  const { data: federalBracketRows } = await supabase
    .from('federal_estate_tax_brackets')
    .select('tax_year, min_amount, max_amount, rate_pct')
    .order('tax_year', { ascending: false })
    .order('min_amount', { ascending: true })

  const federalBrackets = latestFederalBracketsFromRows(federalBracketRows ?? [])

  const datasetsBundle = await loadAdvisorClientDatasets(supabase, {
    clientId,
    userId: advisorUserId,
    householdId: household.id,
    householdStatePrimary: household.state_primary ?? null,
    scenarioId,
    statesToFetch,
    projectionYears,
    include,
  })

  const {
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
    healthScoreComponents,
    monteCarloResults,
    scenarioHistoryForExport,
    scenarioResult,
    stateBracketsResult,
    strategyLineItemsResult,
    assetsResult,
    realEstateResult,
    beneficiariesResult,
    businessesResult,
    insurancePoliciesResult,
  } = datasetsBundle

  const {
    scenario,
    scenarioOutputs,
    scenarioOutputsSecondDeath,
    latestOutput,
    assumptionSnapshot,
    strategyLineItems,
    stateBrackets,
    assets,
    realEstate,
    businesses,
    businessInterests,
    insurancePolicies,
  } = mapAdvisorClientDatasets({
    assetsResult: datasetsBundle.assetsResult,
    realEstateResult: datasetsBundle.realEstateResult,
    beneficiariesResult: datasetsBundle.beneficiariesResult,
    estateDocumentsResult: datasetsBundle.estateDocumentsResult,
    legalDocumentsResult: datasetsBundle.legalDocumentsResult,
    notesResult: datasetsBundle.notesResult,
    scenarioResult,
    domicileAnalysisResult: datasetsBundle.domicileAnalysisResult,
    domicileScheduleResult: datasetsBundle.domicileScheduleResult,
    businessesResult: datasetsBundle.businessesResult,
    liabilitiesResult: datasetsBundle.liabilitiesResult,
    businessInterestsResult: datasetsBundle.businessInterestsResult,
    insurancePoliciesResult: datasetsBundle.insurancePoliciesResult,
    stateExemptionsResult: datasetsBundle.stateExemptionsResult,
    stateBracketsResult,
    stateTaxRulesAllYearsResult: datasetsBundle.stateTaxRulesAllYearsResult,
    stateIncomeTaxBracketsResult: datasetsBundle.stateIncomeTaxBracketsResult,
    strategyLineItemsResult,
    beneficiaryGrantsResult: datasetsBundle.beneficiaryGrantsResult,
  })

  const estateComposition = await getCachedComposition(
    supabase,
    household.id,
    'consumer',
    lifetimeGiftsUsed,
  )

  const strategyVm = buildAdvisorStrategyViewModels({
    currentYear,
    household,
    stateBrackets,
    federalBrackets,
    estateCompositionGrossEstate: Number(estateComposition?.gross_estate ?? 0),
    lifetimeGiftsUsed,
    scenario,
    scenarioOutputs,
    scenarioOutputsSecondDeath,
    latestOutput,
    assumptionSnapshot,
    strategyLineItems,
  })

  const grossForExport = Number(latestOutput?.estate_incl_home ?? 0)
  const narrativeFields = await fetchNarrativePdfFields({
    householdId: household.id,
    clientId,
    grossEstate: strategyVm.advisorHorizons?.today?.grossEstate ?? grossForExport,
    filingStatus: household.filing_status,
    statePrimary: household.state_primary,
  })

  const payloads = await buildAdvisorExportPayloads({
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
    scenarioOutputs,
    latestOutput,
    todayGrossEstate: strategyVm.advisorHorizons?.today?.grossEstate ?? null,
    assumptionSnapshot,
    scenarioForStrategy: strategyVm.scenarioForStrategy,
    narrativeFields,
    stateBrackets,
    federalBrackets: latestFederalBracketsFromRows(federalBracketRows ?? []),
    lifetimeGiftsUsed,
    assets,
    realEstate,
    beneficiaries: (beneficiariesResult.data ?? []) as AssetBeneficiaryRow[],
    businesses,
    businessInterests,
    insurancePolicies,
    compositionFallback: estateComposition
      ? {
          inside_financial: estateComposition.inside_financial,
          inside_real_estate: estateComposition.inside_real_estate,
          inside_business_gross: estateComposition.inside_business_gross,
          inside_insurance: estateComposition.inside_insurance,
        }
      : null,
  })

  const atDeath = strategyVm.advisorHorizons.atDeath
  const meetingPrepAtDeath: MeetingPrepAtDeathSnapshot | null =
    atDeath.grossEstate != null
      ? {
          grossEstate: atDeath.grossEstate,
          totalTaxLiability: atDeath.totalTaxLiability,
          headerTitle: atDeath.headerTitle,
        }
      : null

  return { ...payloads, meetingPrepAtDeath }
}

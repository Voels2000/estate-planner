/**
 * Advisor client workspace (server).
 *
 * Loads authorized household datasets, optional projection regeneration when stale,
 * maps advisor view models, and renders tabbed `ClientViewShell`.
 *
 * Route: `/advisor/clients/[clientId]`
 */

import { createClient } from '@/lib/supabase/server'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import {
  loadAdvisorClientHouseholdOrRedirect,
  loadAdvisorClientLinkOrRedirect,
  loadAdvisorContextOrRedirect,
} from '@/lib/advisor/clientPageLoaders'
import { mapAdvisorClientDatasets } from '@/lib/advisor/mappers'
import { buildAdvisorExportPayloads } from '@/lib/advisor/exportMappers'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import {
  loadAdvisorClientDatasets,
  loadAdvisorDomicileChecklist,
  loadAdvisorProjectionStaleness,
  logAdvisorClientAccess,
} from '@/lib/advisor/loaders'
import ClientViewShell from './_client-view-shell'

interface PageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AdvisorClientPage({ params, searchParams }: PageProps) {
  const { clientId } = await params
  const tab = (await searchParams).tab ?? 'overview'

  // 1) Access and relationship guards
  const supabase = await createClient()
  const { userId } = await loadAdvisorContextOrRedirect(supabase)
  const link = await loadAdvisorClientLinkOrRedirect(supabase, { advisorId: userId, clientId })
  const household = await loadAdvisorClientHouseholdOrRedirect(supabase, clientId)

  const ownerId = clientId

  // Staleness check (same idea as /my-estate-strategy): regenerate when inputs changed after
  // last projection. Uses the client as `ownerId` (not the advisor). On failure, continue with
  // whatever scenario/household data we already have — advisor view should not hard-fail.
  const { isStale } = await loadAdvisorProjectionStaleness(supabase, {
    ownerId,
    baseCaseScenarioId: household.base_case_scenario_id,
    householdUpdatedAt: household.updated_at ?? null,
  })

  if (isStale) {
    const [
      { data: incomeRows },
      { data: assetRows },
      { data: householdFull },
    ] = await Promise.all([
      supabase.from('income').select('id').eq('owner_id', ownerId).limit(1),
      supabase.from('assets').select('id').eq('owner_id', ownerId).limit(1),
      supabase
        .from('households')
        .select(
          'person1_name, person1_first_name, person1_last_name, person1_birth_year, person1_retirement_age, person1_longevity_age, person1_ss_pia, has_spouse, person2_name, person2_first_name, person2_last_name, person2_birth_year, person2_retirement_age, person2_longevity_age, person2_ss_pia',
        )
        .eq('id', household.id)
        .single(),
    ])

    const h = householdFull as {
      person1_name?: string | null
      person1_first_name?: string | null
      person1_last_name?: string | null
      person1_birth_year?: number | null
      person1_retirement_age?: number | null
      person1_longevity_age?: number | null
      person1_ss_pia?: number | null
      has_spouse?: boolean | null
      person2_name?: string | null
      person2_first_name?: string | null
      person2_last_name?: string | null
      person2_birth_year?: number | null
      person2_retirement_age?: number | null
      person2_longevity_age?: number | null
      person2_ss_pia?: number | null
    } | null
    const hasName = (
      fullName: string | null | undefined,
      firstName: string | null | undefined,
      lastName: string | null | undefined,
    ) => Boolean(
      (fullName && fullName.trim().length > 0) ||
      (
        firstName &&
        firstName.trim().length > 0 &&
        lastName &&
        lastName.trim().length > 0
      ),
    )
    const p1Complete = !!(
      hasName(h?.person1_name, h?.person1_first_name, h?.person1_last_name) &&
      h?.person1_birth_year &&
      h?.person1_retirement_age &&
      h?.person1_longevity_age &&
      h?.person1_ss_pia
    )
    const p2Complete = !h?.has_spouse || !!(
      hasName(h?.person2_name, h?.person2_first_name, h?.person2_last_name) &&
      h?.person2_birth_year &&
      h?.person2_retirement_age &&
      h?.person2_longevity_age &&
      h?.person2_ss_pia
    )
    const hasIncome = (incomeRows ?? []).length > 0
    const hasAssets = (assetRows ?? []).length > 0

    if (p1Complete && p2Complete && hasIncome && hasAssets) {
      void (async () => {
        try {
          const { generateBaseCase } = await import('@/lib/actions/generate-base-case')
          await generateBaseCase(household.id)
          const { triggerEstateHealthRecompute } = await import('@/lib/estate/triggerEstateHealthRecompute')
          triggerEstateHealthRecompute(household.id, process.env.NEXT_PUBLIC_APP_URL ?? '')
        } catch (e) {
          console.error('[advisor-client] background base case regeneration failed, using cached data', e)
        }
      })()
    }
  }

  const scenarioId = household.base_case_scenario_id

  // 2) Core data loading and normalization
  const currentYear = new Date().getFullYear()
  const projectionYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5]
  const statesToFetch = ['WA', 'NY', 'MA', 'OR', 'CT', 'AZ']
  const estateComposition = await classifyEstateAssets(supabase, household.id)

  const {
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
  } = await loadAdvisorClientDatasets(supabase, {
    clientId,
    userId,
    householdId: household.id,
    householdStatePrimary: household.state_primary ?? null,
    scenarioId,
    statesToFetch,
    projectionYears,
  })

  const {
    assets,
    realEstate,
    beneficiaries,
    estateDocuments,
    legalDocuments,
    notes,
    estateTax,
    scenario,
    scenarioOutputs,
    scenarioOutputsSecondDeath,
    latestOutput,
    assumptionSnapshot,
    domicileAnalysis,
    domicileSchedule,
    businesses,
    liabilities,
    businessInterests,
    insurancePolicies,
    stateExemptions,
    stateBrackets,
    stateTaxRulesAllYears,
    stateIncomeTaxBrackets,
    strategyLineItems,
    beneficiaryGrants,
  } = mapAdvisorClientDatasets({
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
    beneficiaryGrantsResult,
  })

  const domicileChecklist = await loadAdvisorDomicileChecklist(
    supabase,
    typeof domicileAnalysis?.id === 'string' ? domicileAnalysis.id : null,
  )

  // 3) Strategy and export view models
  const { advisorHorizons, advisorHorizonsProjected, scenarioForStrategy, projectionRowsDomicile, strategySetSummary } = buildAdvisorStrategyViewModels({
    currentYear,
    household,
    stateBrackets,
    estateCompositionGrossEstate: Number(estateComposition?.gross_estate ?? 0),
    scenario,
    scenarioOutputs,
    scenarioOutputsSecondDeath,
    latestOutput,
    assumptionSnapshot,
    strategyLineItems,
  })

  const { exportPanelProps, exportPdfData, exportExcelData } = buildAdvisorExportPayloads({
    household,
    scenarioId,
    advisorDisplayName,
    healthScore,
    liquidAssets,
    activeStrategies,
    actionItems,
    monteCarloResults,
    scenarioHistoryForExport,
    scenarioOutputs,
    latestOutput,
    assumptionSnapshot,
    scenarioForStrategy,
  })

  await logAdvisorClientAccess(supabase, { advisorId: userId, clientId })

  // 4) Route shell composition
  return (
    <ClientViewShell
      tab={tab}
      advisorId={userId}
      clientId={clientId}
      clientStatus={link.client_status ?? 'active'}
      household={household}
      assets={assets ?? []}
      realEstate={realEstate ?? []}
      businesses={businesses}
      liabilities={liabilities}
      businessInterests={businessInterests}
      insurancePolicies={insurancePolicies}
      beneficiaries={beneficiaries ?? []}
      estateDocuments={estateDocuments ?? []}
      legalDocuments={legalDocuments ?? []}
      notes={notes ?? []}
      estateTax={estateTax}
      scenario={scenarioForStrategy}
      scenarioHistory={scenarioHistoryForExport}
      exportPdfData={exportPdfData}
      exportExcelData={exportExcelData}
      exportPanelProps={exportPanelProps}
      projectionRowsDomicile={projectionRowsDomicile}
      beneficiaryGrants={beneficiaryGrants}
      domicileAnalysis={domicileAnalysis ?? null}
      domicileSchedule={domicileSchedule ?? null}
      domicileChecklist={domicileChecklist}
      stateExemptions={stateExemptions}
      stateEstateTaxRules={stateTaxRulesAllYears}
      stateIncomeTaxBrackets={stateIncomeTaxBrackets}
      conflictReport={conflictReport}
      estateComposition={estateComposition}
      advisorHorizons={advisorHorizons}
      advisorHorizonsProjected={advisorHorizonsProjected}
      strategySetSummary={strategySetSummary}
    />
  )
}

/**
 * Advisor client workspace (server).
 *
 * Loads authorized household datasets, optional projection regeneration when stale,
 * maps advisor view models, and renders tabbed `ClientViewShell`.
 *
 * Route: `/advisor/clients/[clientId]`
 */

import { isCstStrategySource } from '@/lib/constants/strategyTypes'
import { createClient } from '@/lib/supabase/server'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import {
  fetchStrategyConfigsWithClient,
  fetchStrategyLineItemsWithClient,
  strategyLineItemsForHorizons,
  type AdvisorStrategyLineItemSummary,
  type StrategyLineItemSummary,
} from '@/lib/estate/strategyLedger'
import {
  loadAdvisorClientHouseholdOrRedirect,
  loadAdvisorClientLinkOrRedirect,
  loadAdvisorContextOrRedirect,
} from '@/lib/advisor/clientPageLoaders'
import { mapAdvisorClientDatasets } from '@/lib/advisor/mappers'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import {
  advisorDatasetIncludeForTab,
  loadAdvisorClientDatasets,
  loadAdvisorDomicileChecklist,
  loadAdvisorGapStatuses,
  loadAdvisorProjectionStaleness,
  logAdvisorClientAccess,
} from '@/lib/advisor/loaders'
import { loadScenarioMonteCarlo } from '@/lib/advisor/loadScenarioMonteCarlo'
import { getCachedAdvisoryMetrics } from '@/lib/advisor/cachedAdvisoryMetrics'
import type { AdvisoryMetric, AdvisoryMetricsInput } from '@/lib/advisoryMetrics'
import type { StrategyQuestionNotification } from '@/components/advisor/ClientStrategyQuestionsCard'
import { markClientStrategyQuestionsRead } from '@/lib/advisor/markClientStrategyQuestionsRead'
import { loadSocialSecurityData } from '@/lib/social-security/loadSocialSecurityData'
import { runRothAnalysis } from '@/lib/calculations/roth-analysis'
import { getRmdStartAge } from '@/lib/calculations/rmdStartAge'
import { resolveDeduction } from '@/lib/tax/resolve-deduction'
import type { YearRow } from '@/lib/calculations/projection-complete'
import type { StateIncomeTaxBracket } from '@/lib/domicile/moveBreakeven'
import { buildAdvisorStatesToFetch } from '@/lib/tax/advisorStateFetchScope'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'
import ClientViewShell from './_client-view-shell'

interface PageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AdvisorClientPage({ params, searchParams }: PageProps) {
  // ENG-1 AUDIT NOTE:
  // calculate_estate_composition with p_source_role='consumer' underreports
  // outside_strategy_total when advisor rows are consumer_accepted, because RPC
  // filters by source_role only. For advisor Estate display, use advisorHorizons.today
  // (actualStrategies: consumer + accepted advisor) built in strategyMappers.ts.
  const { clientId } = await params
  const tab = (await searchParams).tab ?? 'overview'

  // 1) Access and relationship guards
  const supabase = await createClient()
  const { userId } = await loadAdvisorContextOrRedirect(supabase)
  const [link, household] = await Promise.all([
    loadAdvisorClientLinkOrRedirect(supabase, { advisorId: userId, clientId }),
    loadAdvisorClientHouseholdOrRedirect(supabase, clientId),
  ])

  const ownerId = clientId
  const currentYear = new Date().getFullYear()
  const projectionYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5]
  const statesToFetch = buildAdvisorStatesToFetch(household.state_primary)
  const scenarioId = household.base_case_scenario_id

  const datasetInclude = advisorDatasetIncludeForTab(tab)
  const needsStrategyVm = ['strategy', 'tax', 'domicile', 'meeting-prep', 'estate'].includes(tab)
  const needsComposition = ['overview', 'estate', 'strategy', 'tax', 'domicile', 'meeting-prep'].includes(tab)
  const needsGifting = needsComposition
  const needsStalenessCheck = ['estate', 'strategy', 'tax', 'domicile', 'meeting-prep', 'retirement'].includes(tab)
  const needsMonteCarlo = tab === 'strategy'

  const stalenessPromise = needsStalenessCheck
    ? loadAdvisorProjectionStaleness(supabase, {
        ownerId,
        baseCaseScenarioId: household.base_case_scenario_id,
        householdUpdatedAt: household.updated_at ?? null,
        skipGlobalTaxTableStaleness: true,
      })
    : Promise.resolve({ isStale: false })
  const giftingSummaryPromise = needsGifting
    ? supabase.rpc('calculate_gifting_summary', {
        p_household_id: household.id,
      })
    : Promise.resolve({ data: null, error: null })
  const datasetsPromise = loadAdvisorClientDatasets(supabase, {
    clientId,
    userId,
    householdId: household.id,
    householdStatePrimary: household.state_primary ?? null,
    scenarioId,
    statesToFetch,
    projectionYears,
    include: datasetInclude,
  })
  const gapStatusesPromise = loadAdvisorGapStatuses(supabase, {
    advisorId: userId,
    clientId,
  })

  const [{ isStale }, giftingSummaryRes, datasetsBundle, gapStatuses] = await Promise.all([
    stalenessPromise,
    giftingSummaryPromise,
    datasetsPromise,
    gapStatusesPromise,
  ])

  const lifetimeGiftsUsed = needsGifting
    ? Math.max(
        0,
        Number(
          (giftingSummaryRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
            0,
        ) || 0,
      )
    : 0
  const estateComposition = needsComposition
    ? await getCachedComposition(supabase, household.id, 'consumer', lifetimeGiftsUsed)
    : null

  const needsFederalBrackets = needsStrategyVm || datasetInclude.exportWiring
  const federalBrackets = needsFederalBrackets
    ? latestFederalBracketsFromRows(
        (
          await supabase
            .from('federal_estate_tax_brackets')
            .select('tax_year, min_amount, max_amount, rate_pct')
            .order('tax_year', { ascending: false })
            .order('min_amount', { ascending: true })
        ).data ?? [],
      )
    : []

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
      const { triggerBackgroundBaseCaseAndRecompute } = await import(
        '@/lib/projections/triggerBackgroundBaseCase'
      )
      triggerBackgroundBaseCaseAndRecompute(household.id)
    }
  }

  const {
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
    healthScore,
    healthScoreComputedAt,
    liquidAssets,
    activeStrategies,
    actionItems,
    advisorDisplayName,
    advisorProfile,
    healthScoreComponents,
    monteCarloResults,
    scenarioHistoryForExport,
    beneficiaryGrantsResult,
    conflictReport,
  } = datasetsBundle

  const {
    assets,
    realEstate,
    beneficiaries,
    estateDocuments,
    legalDocuments,
    notes,
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

  const domicileChecklist =
    tab === 'domicile'
      ? await loadAdvisorDomicileChecklist(
          supabase,
          typeof domicileAnalysis?.id === 'string' ? domicileAnalysis.id : null,
        )
      : []

  let initialAdvisorLineItems: AdvisorStrategyLineItemSummary[] | undefined
  let initialConsumerLineItems: StrategyLineItemSummary[] | undefined
  let initialStrategyConfigs: Record<string, unknown>[] | undefined
  let initialGiftingActuals:
    | {
        annualUsed: number
        annualCapacity: number
        lifetimeUsed: number
        lifetimeRemaining: number
        perRecipientLimit: number
        splitElected: boolean
        uniqueRecipients: number
      }
    | undefined
  let strategyLineItemsForVm = strategyLineItems

  if (tab === 'strategy') {
    const giftingData = giftingSummaryRes.data as {
      annual_used?: number
      annual_capacity?: number
      lifetime_used?: number
      lifetime_remaining?: number
      per_recipient_limit?: number
      split_elected?: boolean
      unique_recipients?: number
    } | null

    if (giftingData) {
      initialGiftingActuals = {
        annualUsed: giftingData.annual_used ?? 0,
        annualCapacity: giftingData.annual_capacity ?? 0,
        lifetimeUsed: giftingData.lifetime_used ?? 0,
        lifetimeRemaining: giftingData.lifetime_remaining ?? 0,
        perRecipientLimit: giftingData.per_recipient_limit ?? 19000,
        splitElected: giftingData.split_elected ?? false,
        uniqueRecipients: giftingData.unique_recipients ?? 2,
      }
    }

    const [advisorItems, consumerItems, configs] = await Promise.all([
      fetchStrategyLineItemsWithClient(supabase, household.id, 'advisor'),
      fetchStrategyLineItemsWithClient(supabase, household.id, 'consumer'),
      fetchStrategyConfigsWithClient(supabase, household.id),
    ])
    initialAdvisorLineItems = advisorItems
    initialConsumerLineItems = consumerItems
    initialStrategyConfigs = configs
    strategyLineItemsForVm = strategyLineItemsForHorizons(
      advisorItems,
      consumerItems,
    ) as typeof strategyLineItems
  }

  let advisorHorizons = undefined
  let advisorHorizonsProjected = undefined
  let scenarioForStrategy = scenario
  let projectionRowsDomicile: ReturnType<typeof buildAdvisorStrategyViewModels>['projectionRowsDomicile'] = []
  let strategySetSummary = undefined
  let advisorEstateComposition:
    | {
        grossEstate: number
        outsideStrategyTotal: number
        insideTaxableEstate: number
        estimatedFederalTax: number
        estimatedStateTax: number
        estimatedTotalTax: number
        federalExemption: number
        lifetimeGiftsUsed: number
      }
    | undefined

  if (needsStrategyVm) {
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
      strategyLineItems: strategyLineItemsForVm,
    })
    advisorHorizons = strategyVm.advisorHorizons
    advisorHorizonsProjected = strategyVm.advisorHorizonsProjected
    scenarioForStrategy = strategyVm.scenarioForStrategy
    projectionRowsDomicile = strategyVm.projectionRowsDomicile
    strategySetSummary = strategyVm.strategySetSummary
    const today = strategyVm.advisorHorizons.today
    const outsideStrategyTotal =
      Number(today.outsideCertainProbableTotal ?? 0) + Number(today.outsideIllustrativeTotal ?? 0)
    const grossEstate = Number(today.grossEstate ?? 0)
    const estimatedFederalTax = Number(today.federalTaxEstimate ?? 0)
    const estimatedStateTax = Number(today.stateTax ?? 0)
    advisorEstateComposition = {
      grossEstate,
      outsideStrategyTotal,
      insideTaxableEstate: Math.max(0, grossEstate - outsideStrategyTotal),
      estimatedFederalTax,
      estimatedStateTax,
      estimatedTotalTax: estimatedFederalTax + estimatedStateTax,
      federalExemption: Number(today.federalExemption ?? 0),
      lifetimeGiftsUsed,
    }
  }

  let cachedAdvisoryMetrics: AdvisoryMetric[] | undefined
  let advisoryMetricsInput: AdvisoryMetricsInput | undefined
  let hasRunStrategyModules = false
  if (tab === 'strategy' && needsStrategyVm && advisorHorizons) {
    hasRunStrategyModules = (strategyLineItemsForVm ?? []).some(
      (item) => item.is_active && Math.abs(Number(item.amount ?? 0)) > 0,
    )
    const today = advisorHorizons.today
    advisoryMetricsInput = {
      grossEstate: Number(today.grossEstate ?? 0),
      federalExemption: Number(today.federalExemption ?? 0),
      federalTax: Number(today.federalTaxEstimate ?? 0),
      stateTax: Number(today.stateTax ?? 0),
      hasSpouse: household.has_spouse ?? false,
      dsueAvailable: household.has_spouse ? Number(today.federalExemption ?? 0) : 0,
      liquidAssets,
      ilitDeathBenefit: (insurancePolicies ?? [])
        .filter((p) => p.is_ilit)
        .reduce((sum, p) => sum + Number(p.death_benefit ?? 0), 0),
      section7520Rate: 0.052,
      cstGrowthRate: 0.06,
      survivorExemption: Number(today.federalExemption ?? 0),
    }
    cachedAdvisoryMetrics = await getCachedAdvisoryMetrics(
      household.id,
      `${household.updated_at ?? 'na'}-${today.grossEstate}-${today.federalTaxEstimate}`,
      {
        ...advisoryMetricsInput,
        cstFundingAmount: hasRunStrategyModules
          ? Number(
              strategyLineItemsForVm.find((i) => isCstStrategySource(i.strategy_source))?.amount ?? 0,
            ) || undefined
          : undefined,
      },
    )
  }

  void logAdvisorClientAccess(supabase, { advisorId: userId, clientId })

  const { data: strategyQuestionRows } = await supabase
    .from('notifications')
    .select('id, title, created_at, metadata')
    .eq('user_id', userId)
    .eq('type', 'consumer_strategy_question')
    .eq('read', false)
    .order('created_at', { ascending: false })

  const strategyQuestions: StrategyQuestionNotification[] = (strategyQuestionRows ?? [])
    .filter((row) => {
      const meta = row.metadata as { client_id?: string } | null
      return meta?.client_id === clientId
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      metadata: (row.metadata ?? {}) as StrategyQuestionNotification['metadata'],
    }))

  void markClientStrategyQuestionsRead(supabase, userId, clientId)

  let advisorSsData: Awaited<ReturnType<typeof loadSocialSecurityData>> = null
  let advisorRothData: ReturnType<typeof runRothAnalysis> | null = null
  let retirementScenarioOutputs: YearRow[] = (scenarioOutputs ?? []) as YearRow[]

  if (tab === 'retirement') {
    const [ssData, federalBracketsRes, householdDeductionRes] = await Promise.all([
      loadSocialSecurityData(supabase, clientId).catch(() => null),
      supabase
        .from('federal_tax_brackets')
        .select('filing_status, min_amount, max_amount, rate_pct, tax_year, bracket_order')
        .order('tax_year', { ascending: false })
        .order('filing_status', { ascending: true })
        .order('bracket_order', { ascending: true }),
      supabase
        .from('households')
        .select('deduction_mode, custom_deduction_amount')
        .eq('owner_id', clientId)
        .single(),
    ])

    advisorSsData = ssData
    retirementScenarioOutputs = (scenarioOutputs ?? []) as YearRow[]

    if (retirementScenarioOutputs.length > 0) {
      try {
        const TAX_DEFERRED_TYPES = [
          'traditional_ira',
          'traditional_401k',
          'traditional_403b',
          '401k',
          '403b',
          'ira',
          'sep_ira',
          'simple_ira',
          '457',
          'sep',
          'retirement_account',
        ]
        const ROTH_TYPES = ['roth_ira', 'roth_401k', 'roth_403b', 'roth']
        const TAXABLE_TYPES = [
          'brokerage',
          'taxable_brokerage',
          'savings',
          'checking',
          'money_market',
          'cash',
        ]

        const assetRows = (assets ?? []) as Array<{ type?: string | null; value?: number | null }>
        const taxDeferredBalance = assetRows
          .filter((a) => TAX_DEFERRED_TYPES.includes(String(a.type ?? '')))
          .reduce((s, a) => s + Number(a.value ?? 0), 0)
        const rothBalance = assetRows
          .filter((a) => ROTH_TYPES.includes(String(a.type ?? '')))
          .reduce((s, a) => s + Number(a.value ?? 0), 0)
        const taxableBalance = assetRows
          .filter((a) => TAXABLE_TYPES.includes(String(a.type ?? '')))
          .reduce((s, a) => s + Number(a.value ?? 0), 0)

        const hhDeduction = householdDeductionRes.data as {
          deduction_mode?: string | null
          custom_deduction_amount?: number | null
        } | null

        advisorRothData = runRothAnalysis({
          rows: retirementScenarioOutputs,
          filingStatus: household.filing_status ?? 'single',
          stateCode: household.state_primary?.toUpperCase() ?? null,
          stateIncomeTaxBrackets: (stateIncomeTaxBrackets ?? []) as StateIncomeTaxBracket[],
          federalIncomeTaxBrackets: (federalBracketsRes.data ?? []) as Array<{
            filing_status: string
            min_amount: number
            max_amount: number | null
            rate_pct: number
            tax_year?: number | null
            bracket_order?: number | null
          }>,
          taxDeferredBalance,
          rothBalance,
          taxableBalance,
          growthRateRetirement: (household.growth_rate_retirement ?? 5) / 100,
          maxAnnualConversion: 500_000,
          standardDeduction: resolveDeduction(
            hhDeduction?.deduction_mode,
            hhDeduction?.custom_deduction_amount,
            household.filing_status ?? 'single',
          ),
          inflationRate: (household.inflation_rate ?? 2.5) / 100,
          person1BirthYear: household.person1_birth_year ?? 1960,
          person2BirthYear: household.has_spouse ? household.person2_birth_year : null,
          rmdStartAge: getRmdStartAge(household.person1_birth_year ?? 1960),
        })
      } catch {
        advisorRothData = null
      }
    }
  }

  const mcScenarioId =
    scenario && typeof (scenario as { id?: string }).id === 'string'
      ? String((scenario as { id: string }).id)
      : null
  const mcSummary =
    needsMonteCarlo && mcScenarioId
      ? await loadScenarioMonteCarlo(mcScenarioId, supabase)
      : null

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
      scenario={scenarioForStrategy}
      scenarioHistory={scenarioHistoryForExport}
      lazyLoadExportPayload={tab === 'meeting-prep'}
      projectionRowsDomicile={projectionRowsDomicile}
      beneficiaryGrants={beneficiaryGrants}
      domicileAnalysis={domicileAnalysis ?? null}
      domicileSchedule={domicileSchedule ?? null}
      domicileChecklist={domicileChecklist}
      stateExemptions={stateExemptions}
      stateBrackets={stateBrackets}
      stateEstateTaxRules={stateTaxRulesAllYears}
      stateIncomeTaxBrackets={stateIncomeTaxBrackets}
      federalBrackets={federalBrackets}
      conflictReport={conflictReport}
      estateComposition={estateComposition}
      advisorEstateComposition={advisorEstateComposition}
      advisorHorizons={advisorHorizons}
      advisorHorizonsProjected={advisorHorizonsProjected}
      strategySetSummary={strategySetSummary}
      planReadinessScore={healthScore}
      planReadinessComputedAt={healthScoreComputedAt}
      connectionLifeEventType={link.connection_life_event_type}
      connectionLifeEventAt={link.connection_life_event_at}
      strategyQuestions={strategyQuestions}
      gapStatuses={gapStatuses}
      cachedAdvisoryMetrics={cachedAdvisoryMetrics}
      advisoryMetricsInput={advisoryMetricsInput}
      hasRunStrategyModules={hasRunStrategyModules}
      initialAdvisorLineItems={initialAdvisorLineItems}
      initialConsumerLineItems={initialConsumerLineItems}
      initialStrategyConfigs={initialStrategyConfigs}
      initialGiftingActuals={initialGiftingActuals}
      scenarioOutputs={retirementScenarioOutputs}
      advisorSsData={advisorSsData}
      advisorRothData={advisorRothData}
      mcSummary={mcSummary}
    />
  )
}

/**
 * Consumer dashboard (server).
 *
 * Loads household inputs, projection staleness, RMD and income snapshots, and maps
 * view models for `DashboardClient`.
 *
 * Route: `/dashboard`
 */


import { getCompletionScore } from '@/lib/get-completion-score'
import type { YearRow } from '@/lib/calculations/projection-complete'
import {
  computeBusinessOwnershipValue,
} from '@/lib/my-estate-strategy/horizonSnapshots'
import {
  computeYearsToRetirement,
  getRetirementIncomeProjection,
} from '@/lib/dashboard/retirementSnapshot'
import { buildRmdStatus } from '@/lib/dashboard/rmdStatus'
import { buildIncomeSnapshot } from '@/lib/dashboard/incomeSnapshot'
import { loadDashboardBundle, setupProgressFromBundle } from '@/lib/dashboard/loadDashboardBundle'
import {
  loadBaseCaseScenario,
  loadDashboardCoreInputs,
  loadDashboardRmdInputs,
  loadLatestInputChangeMs,
  loadProjectionCalculatedAt,
} from '@/lib/dashboard/loaders'
import { isProjectionStale } from '@/lib/projections/staleness'
import {
  mapConflictReport,
  mapEstateHealthScore,
} from '@/lib/dashboard/mappers'
import { buildNetWorthSummaryFromDashboardInput } from '@/lib/view-models/netWorthSummary'
import { buildRetirementSnapshot } from '@/lib/view-models/retirementSnapshot'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { computeHeadroomBeforeFederalTax } from '@/lib/estate/exemptionLabels'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { buildConsumerMCScenariosFromRows } from '@/lib/monte-carlo/consumerAssumptionScenarios'
import { DashboardClient } from '../_dashboard-client'
import type { LifeEvent, LoggedLifeEvent } from '@/app/(dashboard)/_components/LifeEventBanner'
import { buildPersonaDashboardAlerts } from '@/lib/dashboard/personaAlerts'
import { isWizardComplete } from '@/lib/estate/profileGate'
import { buildEstateExecutionChecklist } from '@/lib/dashboard/buildEstateExecutionChecklist'
import type { EstateExecutionItem } from '@/lib/dashboard/buildEstateExecutionChecklist'
import { determinePlanStage, getDashboardState } from '@/lib/dashboard/determinePlanStage'
import { getUserAccess } from '@/lib/get-user-access'
import type { OnboardingPersona } from '@/lib/onboarding/personaConfig'
import { sortOpenAlerts } from '@/lib/dashboard/scoreDisplayHelpers'

type HouseholdRow = Record<string, unknown> & {
  id: string
  owner_id: string
  base_case_scenario_id: string | null
  updated_at: string | null
  person1_birth_year: number | null
  person2_birth_year: number | null
  person1_name: string | null
  person2_name: string | null
  person1_ss_claiming_age: number | null
  person1_ss_pia: number | string | null
  person2_ss_claiming_age: number | null
  person2_ss_pia: number | string | null
  has_spouse: boolean | null
  person1_retirement_age: number | null
  person2_retirement_age: number | null
  succession_plan_in_place: boolean | null
  state_primary: string | null
  has_minor_children: boolean | null
  has_business_interests: boolean | null
}

export async function DashboardBody({
  household,
  userId,
  userEmail,
}: {
  household: HouseholdRow
  userId: string
  userEmail: string
}) {
  const supabase = await createClient()
  const user = { id: userId, email: userEmail }
  const admin = createAdminClient()
  const access = await getUserAccess()

  const bundle = await loadDashboardBundle(supabase, admin, {
    userId: user!.id,
    householdId: household.id,
    statePrimary: household.state_primary,
  })

  // Background staleness check for base-case projection:
  // regenerate asynchronously when user inputs or tax brackets are newer than the last run.
  const projectionCalculatedAt = await loadProjectionCalculatedAt(admin, household.base_case_scenario_id)
  const latestInputChangeMs = await loadLatestInputChangeMs(
    supabase,
    user!.id,
    household.updated_at ?? null,
    bundle,
  )

  const isStale = isProjectionStale({
    baseCaseScenarioId: household.base_case_scenario_id,
    projectionCalculatedAt,
    latestInputChangeMs,
  })

  if (isStale) {
    const { triggerBackgroundBaseCaseAndRecompute } = await import(
      '@/lib/projections/triggerBackgroundBaseCase'
    )
    triggerBackgroundBaseCaseAndRecompute(household.id)
  }

  const baseCaseScenario = await loadBaseCaseScenario(admin, household?.base_case_scenario_id)

  const {
    profile,
    assets,
    liabilities,
    income,
    expenses,
    realEstate,
    businesses,
    businessInterests,
    insurance,
  } = await loadDashboardCoreInputs(supabase, user!.id, bundle)

  const pendingLifeEvents = bundle.lifeEventsPending as LifeEvent[]
  const loggedLifeEvents = bundle.lifeEventsLogged as LoggedLifeEvent[]
  const advisorConnection = bundle.advisorConnection
  const hasAdvisorConnection = !!advisorConnection
  const advisorProfile = advisorConnection?.profiles
    ? Array.isArray(advisorConnection.profiles)
      ? advisorConnection.profiles[0] ?? null
      : advisorConnection.profiles
    : null
  const advisorConnectionSummary =
    advisorConnection && advisorConnection.accepted_at
      ? {
          id: String(advisorConnection.id),
          advisorName:
            (advisorProfile as { full_name?: string | null; email?: string | null } | null)
              ?.full_name?.trim() ||
            (advisorProfile as { email?: string | null } | null)?.email ||
            'Your advisor',
          connectedAt: String(advisorConnection.accepted_at),
        }
      : null
  const hasBusinessInterests =
    (businesses?.length ?? 0) > 0 || (businessInterests?.length ?? 0) > 0
  const hasRealEstate = (realEstate?.length ?? 0) > 0
  const primaryAge =
    household.person1_birth_year != null
      ? new Date().getFullYear() - household.person1_birth_year
      : null
  const successionGap =
    hasBusinessInterests && household.succession_plan_in_place !== true

  const personaAlerts = buildPersonaDashboardAlerts({
    businesses: businesses ?? [],
    businessInterests: businessInterests ?? [],
    realEstate: realEstate ?? [],
  })

  // ── Financial calculations (legacy fallback path) ────────────────────────
  const financialAssetsFallback = (assets ?? []).reduce((s, a) => s + Number(a.value), 0)
  const realEstateEquityFallback = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value) - Number(r.mortgage_balance ?? 0), 0,
  )
  const businessValueFallback = computeBusinessOwnershipValue(businesses ?? [], businessInterests ?? [])
  const insuranceValueFallback = (insurance ?? [])
    .filter(p => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const currentYear = new Date().getFullYear()

  const p1BirthYear = household?.person1_birth_year ?? null
  const p1SSClaimingAge = household?.person1_ss_claiming_age ?? null
  const p1SSPia = household?.person1_ss_pia ? Number(household.person1_ss_pia) : null
  const p2BirthYear = household?.person2_birth_year ?? null
  const p2SSClaimingAge = household?.person2_ss_claiming_age ?? null
  const p2SSPia = household?.person2_ss_pia ? Number(household.person2_ss_pia) : null
  const hasSpouse = household?.has_spouse ?? false

  const baseExpenses = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0)
  const {
    totalIncome,
    totalExpenses,
    savingsRate,
    currentYearNet,
    annualSSFromPIA,
    totalMortgageBalance,
    combinedSSMonthly,
    p1MonthlyBenefit,
    p2MonthlyBenefit,
  } = buildIncomeSnapshot({
    currentYear,
    incomeRows: income ?? [],
    realEstateRows: realEstate ?? [],
    hasSpouse,
    p1BirthYear,
    p1SSClaimingAge,
    p1SSPia,
    p2BirthYear,
    p2SSClaimingAge,
    p2SSPia,
    expensesTotal: baseExpenses,
  })

  // ── Tier / completion + gift-aware estate composition ───────────────────
  const isConsumerTier2 = profile?.role === 'consumer' && access.tier === 2

  const giftingSummary = household?.id
    ? await supabase.rpc('calculate_gifting_summary', {
        p_household_id: household.id,
      })
    : { data: null }

  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummary.data as { lifetime_exemption_used?: number } | null)
        ?.lifetime_exemption_used ?? 0,
    ) || 0,
  )

  const [completionScore, composition] = await Promise.all([
    isConsumerTier2 ? getCompletionScore(user!.id) : Promise.resolve(null),
    household?.id
      ? getCachedComposition(supabase, household.id, 'consumer', lifetimeGiftsUsed)
      : Promise.resolve(null),
  ])

  const estateCallout =
    composition && composition.success !== false
      ? (() => {
          const grossEstate = Number(composition.gross_estate ?? 0)
          const exemptionAvailable = Number(composition.exemption_available ?? 0)
          const outsideStrategyTotal = Number(composition.outside_strategy_total ?? 0)
          const headroom = computeHeadroomBeforeFederalTax(
            exemptionAvailable,
            grossEstate,
            outsideStrategyTotal,
          )
          return {
            grossEstate,
            exemptionRemaining: headroom,
            estimatedTaxFederal: Number(composition.estimated_tax_federal ?? 0),
            estimatedTaxState: Number(composition.estimated_tax_state ?? 0),
            hasStateTax: Number(composition.estimated_tax_state ?? 0) > 0,
            exemptionMarginTight:
              exemptionAvailable > 0 && headroom < exemptionAvailable * 0.2,
          }
        })()
      : null

  // ── Financial calculations (engine-aligned primary path) ─────────────────
  // Use composition rollups so Dashboard net worth matches estate engine:
  // gross estate at FMV minus total liabilities.
  const otherLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const {
    financialAssets,
    realEstateValue: realEstateFMV,
    businessValue,
    insuranceValue,
    totalAssets,
    totalLiabilities,
    netWorth,
  } = buildNetWorthSummaryFromDashboardInput({
    composition,
    financialAssetsFallback,
    realEstateValueFallback: realEstateEquityFallback,
    businessValueFallback,
    insuranceValueFallback,
    mortgageBalance: totalMortgageBalance,
    otherLiabilities,
  })
  void insuranceValue

  const advisorStrategyItems = bundle.advisorStrategyItems
  const healthScoreRow = bundle.healthScoreRow
  const openAlertsData = bundle.openAlertsData
  const conflictRows = bundle.conflictRows
  const stateExemptionRow = bundle.stateExemptionRow
  const { taxDeferredAssets, currentYearWithdrawals } = await loadDashboardRmdInputs(
    supabase,
    user!.id,
    bundle,
  )

  const { acceptedMCScenario, latestSharedMCScenario } = buildConsumerMCScenariosFromRows(
    bundle.mcScenarioRows as Parameters<typeof buildConsumerMCScenariosFromRows>[0],
  )

  // Recommendations are populated by recompute (triggerEstateHealthRecompute).
  // Empty on first load before first household write — shows empty state, not an error.
  // Sprint P-2: removed generate_estate_recommendations from dashboard hot path.
  const cachedRecsPayload = healthScoreRow?.recommendations as
    | { recommendations?: unknown }
    | null
    | undefined
  const initialRecommendations =
    cachedRecsPayload &&
    typeof cachedRecsPayload === 'object' &&
    Array.isArray(cachedRecsPayload.recommendations)
      ? cachedRecsPayload.recommendations
      : null

  // ── Estate health score — read from cache, recomputed async on staleness ─
  // computeEstateHealthScore writes to DB — never call it in render path.
  // Dashboard reads the last persisted score; background recompute updates it.
  const estateHealthScore = mapEstateHealthScore(
    healthScoreRow as Parameters<typeof mapEstateHealthScore>[0],
  )

  const openAlerts = sortOpenAlerts(
    openAlertsData.map((a) => ({
      id: String(a.id),
      title: (a.title as string | null) ?? null,
      message: (a.description as string | null) ?? null,
      severity: String(a.severity ?? ''),
      created_at: String(a.created_at ?? ''),
      action_href: (a.action_href as string | null | undefined) ?? null,
    })),
  )

  // ── Base case (projection rows) — same source as My Estate Strategy ──────
  const baseCaseRows: YearRow[] = baseCaseScenario?.outputs_s1_first ?? []

  // ── Conflict detector — read from cache, recomputed async on staleness ───
  // detectConflicts writes to DB — never call it in render path.
  const conflictReport = mapConflictReport(
    conflictRows as unknown as Parameters<typeof mapConflictReport>[0],
  )

  // ── RMD Status for current year ──────────────────────────────────────

  const rmdStatus = buildRmdStatus({
    currentYear,
    hasSpouse,
    p1BirthYear,
    p2BirthYear,
    p1NameRaw: household?.person1_name ?? null,
    p2NameRaw: household?.person2_name ?? null,
    p1DisplayName: displayPersonFirstName(household?.person1_name, 'Person 1'),
    p2DisplayName: hasSpouse ? displayPersonFirstName(household?.person2_name, 'Person 2') : null,
    taxDeferredAssets: taxDeferredAssets ?? [],
    currentYearWithdrawals: currentYearWithdrawals ?? [],
  })

  // ── Retirement snapshot — from households table ──────────────────────────
  const p1RetirementAge = household?.person1_retirement_age ?? null
  const p2RetirementAge = household?.person2_retirement_age ?? null
  const p2SSClaimingAge2 = household?.person2_ss_claiming_age ?? null

  const yearsToRetirement = computeYearsToRetirement(currentYear, p1BirthYear, p1RetirementAge)
  const { projectedAnnualIncome, projectedAnnualExpenses, projectedIncomeGap } =
    getRetirementIncomeProjection(baseCaseRows, p1BirthYear, p1RetirementAge, totalExpenses)

  const hasRetirementInputs = !!(p1RetirementAge || p1SSPia || p2SSPia)

  const RETIREMENT_ACCOUNT_TYPES = new Set([
    'traditional_ira',
    'traditional_401k',
    'sep_account',
    'roth_ira',
    'roth_401k',
  ])
  const retirementAccountsTotal = (assets ?? [])
    .filter((a) => RETIREMENT_ACCOUNT_TYPES.has(String((a as { type?: string }).type ?? '')))
    .reduce((sum, a) => sum + Number(a.value ?? 0), 0)

  const retirementSnapshot = buildRetirementSnapshot({
    hasRetirementInputs,
    hasSpouse,
    p1Name: household?.person1_name != null ? displayPersonFirstName(household.person1_name) : null,
    p1RetirementAge,
    p1SSClaimingAge,
    p1MonthlyBenefit,
    p1BirthYear,
    p2Name: household?.person2_name != null ? displayPersonFirstName(household.person2_name) : null,
    p2RetirementAge,
    p2SSClaimingAge: p2SSClaimingAge2,
    p2MonthlyBenefit,
    yearsToRetirement,
    combinedSSMonthly,
    projectedAnnualIncome,
    projectedAnnualExpenses,
    projectedIncomeGap,
  })

  const wizardComplete = isWizardComplete(profile)
  const setupProgress = setupProgressFromBundle(bundle)
  const initialAssessmentResults = bundle.assessmentResults

  const consumerTier = access.tier
  const conflictCount = conflictReport?.conflicts.length ?? 0

  let executionChecklist: EstateExecutionItem[] = []
  if (household?.id && totalAssets > 0) {
    executionChecklist = await buildEstateExecutionChecklist(supabase, {
      householdId: household.id,
      ownerId: user!.id,
      userTier: consumerTier,
      beneficiaryConflictsCount: conflictCount,
      hasMinorChildren: household.has_minor_children === true,
      hasBusinessInterests:
        household.has_business_interests === true || hasBusinessInterests,
    })
  }

  const financialSectionsComplete = [
    setupProgress.assets > 0,
    setupProgress.income > 0,
    setupProgress.expenses > 0,
    setupProgress.liabilities > 0,
    setupProgress.insurance > 0,
  ].filter(Boolean).length

  const checklistActiveItems = executionChecklist.filter((i) => i.status !== 'not_applicable')
  const checklistCompletedCount = checklistActiveItems.filter(
    (i) => i.status === 'complete' || i.consumerChecked,
  ).length
  const checklistTotalCount = checklistActiveItems.length
  const checklistPct =
    checklistTotalCount > 0
      ? Math.round((checklistCompletedCount / checklistTotalCount) * 100)
      : 0

  const planStage = determinePlanStage({
    financialSectionsComplete,
    wizardComplete,
    userTier: consumerTier,
    checklistPct,
    checklistCompletedCount,
    checklistTotalCount,
    hasEstateData: !!estateCallout,
    hasAdvisor: hasAdvisorConnection,
  })

  const hasEstatePlanData =
    (conflictReport?.conflicts?.length ?? 0) > 0 ||
    (estateHealthScore?.components?.some((c) => c.score > 0) ?? false) ||
    executionChecklist.length > 0

  const dashboardState = getDashboardState({
    foundationScore: estateHealthScore?.score ?? null,
    wizardCompletedAt: profile?.onboarding_wizard_completed_at ?? null,
    estimatedTaxState: estateCallout?.estimatedTaxState ?? 0,
    estimatedTaxFederal: estateCallout?.estimatedTaxFederal ?? 0,
    hasAnyHouseholdData: totalAssets > 0,
    hasEstatePlanData,
  })

  const assetTypes = bundle.assetTypes

  const { data: authUserData } = await admin.auth.admin.getUserById(userId)
  const accountCreatedAt = authUserData?.user?.created_at
  const withinFirstWeek =
    accountCreatedAt != null &&
    Date.now() - new Date(accountCreatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000

  const onboardingPersona = profile?.onboarding_persona as OnboardingPersona | null | undefined
  const hasBusinessAssetFromAssets = (assets ?? []).some(
    (a) => (a as { type?: string }).type === 'business',
  )
  const hasBusinessAsset = hasBusinessInterests || hasBusinessAssetFromAssets
  const hasRealEstateAssetFromAssets = (assets ?? []).some((a) => {
    const t = String((a as { type?: string }).type ?? '')
    return t === 'real_estate' || t.includes('real')
  })
  const hasRealEstateAsset = hasRealEstate || hasRealEstateAssetFromAssets

  const personaInsight =
    onboardingPersona && withinFirstWeek
      ? {
          persona: onboardingPersona,
          showCard: true,
          totalAssets,
          hasBusinessAsset,
          hasRealEstateAsset,
          distinctPropertyStates: personaAlerts.distinctPropertyStates.length,
          estateTaxEstimate: estateCallout?.estimatedTaxFederal ?? null,
          retirementAge: p1RetirementAge,
          currentAge: p1BirthYear != null ? currentYear - p1BirthYear : null,
          yearsToRetirement,
        }
      : null

  return (
    <DashboardClient
      dashboardState={dashboardState}
      foundationScore={estateHealthScore?.score ?? 0}
      planStage={planStage}
      termsAcceptedAt={profile?.terms_accepted_at ?? null}
      wizardComplete={wizardComplete}
      initialSetupProgress={setupProgress}
      composition={composition}
      userName={profile?.full_name ?? user!.email ?? ''}
      totalAssets={totalAssets}
      totalLiabilities={totalLiabilities}
      netWorth={netWorth}
      netWorthBySource={{
        financial: financialAssets,
        realEstateEquity: realEstateFMV,
        business: businessValue,
        insurance: insuranceValue,
      }}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      savingsRate={savingsRate}
      currentYearNet={currentYearNet}
      annualSSFromPIA={annualSSFromPIA}
      retirementSnapshot={retirementSnapshot}
      retirementAccountsTotal={retirementAccountsTotal}
      estateHealthScore={estateHealthScore}
      openAlerts={openAlerts}
      conflictReport={conflictReport}
      userId={user!.id}
      householdId={household?.id ?? null}
      hasBaseCase={!!household?.base_case_scenario_id}
      scenarioId={household?.base_case_scenario_id ?? null}
      completionScore={completionScore}
      consumerTier={consumerTier}
      executionChecklist={executionChecklist}
      isAdvisor={profile?.role === 'advisor'}
      rmdStatus={rmdStatus}
      mortgageBalance={totalMortgageBalance}
      otherLiabilities={otherLiabilities}
      initialRecommendations={initialRecommendations}
      advisorStrategyItems={(advisorStrategyItems ?? []).map((item: Record<string, unknown>) => ({
        id: String(item.id),
        strategy_source: String(item.strategy_source ?? ''),
        amount: Number(item.amount ?? 0),
        sign: typeof item.sign === 'number' ? item.sign : -1,
        scenario_name: (item.scenario_name as string | null) ?? null,
        consumer_accepted: item.consumer_accepted === true,
        consumer_rejected: item.consumer_rejected === true,
      }))}
      acceptedMCScenario={acceptedMCScenario}
      latestSharedMCScenario={latestSharedMCScenario}
      estateCallout={estateCallout}
      pendingLifeEvents={pendingLifeEvents}
      loggedLifeEvents={loggedLifeEvents}
      lifeEventRelevance={{
        hasBusinessInterests,
        hasRealEstate,
        primaryAge,
      }}
      hasAdvisorConnection={hasAdvisorConnection}
      advisorConnectionSummary={advisorConnectionSummary}
      successionGap={successionGap}
      personaAlerts={personaAlerts}
      initialAssessmentResults={initialAssessmentResults}
      statePrimary={household?.state_primary ?? null}
      stateExemption={
        stateExemptionRow?.exemption_amount != null
          ? Number(stateExemptionRow.exemption_amount)
          : null
      }
      noPortability={stateExemptionRow?.no_portability === true}
      assetTypes={
        assetTypes as Array<{ value: string; label: string }>
      }
      person1Name={household?.person1_name ?? 'Person 1'}
      person2Name={household?.person2_name ?? 'Person 2'}
      hasSpouse={household?.has_spouse === true}
      personaInsight={personaInsight}
    />
  )
}

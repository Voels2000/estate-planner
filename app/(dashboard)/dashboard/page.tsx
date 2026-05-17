/**
 * Consumer dashboard (server).
 *
 * Loads household inputs, projection staleness, RMD and income snapshots, and maps
 * view models for `DashboardClient`.
 *
 * Route: `/dashboard`
 */

import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { getCompletionScore } from '@/lib/get-completion-score'
import type { YearRow } from '@/lib/calculations/projection-complete'
import {
  computeBusinessOwnershipValue,
} from '@/lib/my-estate-strategy/horizonSnapshots'
import { buildDashboardSetupProgress } from '@/lib/dashboard/setupProgress'
import {
  computeYearsToRetirement,
  getRetirementIncomeProjection,
} from '@/lib/dashboard/retirementSnapshot'
import { buildRmdStatus } from '@/lib/dashboard/rmdStatus'
import { buildIncomeSnapshot } from '@/lib/dashboard/incomeSnapshot'
import {
  loadBaseCaseScenario,
  loadDashboardCoreInputs,
  loadDashboardRmdInputs,
  loadLatestInputChangeMs,
  loadProjectionCalculatedAt,
} from '@/lib/dashboard/loaders'
import { isProjectionStale } from '@/lib/projections/staleness'
import {
  buildAllocationContext,
  mapConflictReport,
  mapEstateHealthScore,
} from '@/lib/dashboard/mappers'
import { buildNetWorthSummaryFromDashboardInput } from '@/lib/view-models/netWorthSummary'
import { buildRetirementSnapshot } from '@/lib/view-models/retirementSnapshot'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { computeHeadroomBeforeFederalTax } from '@/lib/estate/exemptionLabels'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { buildConsumerMCScenariosFromRows } from '@/lib/monte-carlo/consumerAssumptionScenarios'
import { DashboardClient } from '../_dashboard-client'
import { DashboardEmptyState } from './_components/DashboardEmptyState'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!household || householdError) {
    return <DashboardEmptyState />
  }

  const admin = createAdminClient()

  // Background staleness check for base-case projection:
  // regenerate asynchronously when user inputs or tax brackets are newer than the last run.
  const projectionCalculatedAt = await loadProjectionCalculatedAt(admin, household.base_case_scenario_id)
  const latestInputChangeMs = await loadLatestInputChangeMs(
    supabase,
    user!.id,
    household.updated_at ?? null,
  )

  const isStale = isProjectionStale({
    baseCaseScenarioId: household.base_case_scenario_id,
    projectionCalculatedAt,
    latestInputChangeMs,
  })

  if (isStale) {
    void (async () => {
      try {
        const { generateBaseCase } = await import('@/lib/actions/generate-base-case')
        await generateBaseCase(household.id)
        const { triggerHouseholdRecompute } = await import('@/lib/consumer/afterHouseholdWrite')
        triggerHouseholdRecompute(household.id)
      } catch (e) {
        console.error('[dashboard] background base case regeneration failed', e)
      }
    })()
  }

  const baseCaseScenario = await loadBaseCaseScenario(admin, household?.base_case_scenario_id)

  // ── Parallel data fetch ──────────────────────────────────────────────────
  // Income query now includes ALL sources (including social_security) so the
  // current-year net income calculation is complete.
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
  } = await loadDashboardCoreInputs(supabase, user!.id)

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
  // Derive from baseCaseScenario already loaded above — no HTTP roundtrip needed
  const hasLiveProjectionOutput =
    Array.isArray(baseCaseScenario?.outputs_s1_first) &&
    (baseCaseScenario.outputs_s1_first as unknown[]).length > 0

  // ── Setup steps — "Compare scenarios" removed (no longer a gate) ─────────
  const { setupSteps, completedSteps, progressPct } = buildDashboardSetupProgress({
    hasProfileBasics: !!(household?.person1_name && household?.person1_birth_year),
    assetsCount: (assets ?? []).length,
    liabilitiesCount: (liabilities ?? []).length,
    incomeCount: (income ?? []).length,
    expensesCount: (expenses ?? []).length,
    hasLiveProjectionOutput,
  })

  // ── Tier / completion + gift-aware estate composition ───────────────────
  const isConsumerTier2 = profile?.role === 'consumer' && (profile?.consumer_tier ?? 1) === 2

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
      ? classifyEstateAssets(supabase, household.id, 'consumer', lifetimeGiftsUsed)
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

  const { data: advisorStrategyItems } = household?.id
    ? await supabase
        .from('strategy_line_items')
        .select('id, strategy_source, amount, sign, scenario_name, consumer_accepted, consumer_rejected')
        .eq('household_id', household.id)
        .eq('source_role', 'advisor')
        .eq('is_active', true)
    : { data: null }

  const mcScenarioRes = household?.id
    ? await supabase
        .from('advisor_projection_assumptions')
        .select(
          'id, scenario_name, shared_at, accepted_by_client, accepted_at, return_mean_pct, volatility_pct, withdrawal_rate_pct, success_threshold, simulation_count, planning_horizon_yr, inflation_rate_pct',
        )
        .eq('client_household_id', household.id)
        .or('accepted_by_client.eq.true,shared_at.not.is.null')
        .order('accepted_at', { ascending: false, nullsFirst: false })
    : { data: null }

  const { acceptedMCScenario, latestSharedMCScenario } = buildConsumerMCScenariosFromRows(
    mcScenarioRes.data ?? [],
  )

  const { data: initialRecsData } = household?.id
    ? await supabase.rpc('generate_estate_recommendations', {
        p_household_id: household.id,
      })
    : { data: null }

  const initialRecommendations = initialRecsData?.recommendations ?? null

  // ── Estate health score — read from cache, recomputed async on staleness ─
  // computeEstateHealthScore writes to DB — never call it in render path.
  // Dashboard reads the last persisted score; background recompute updates it.
  const { data: healthScoreRow } = household?.id
    ? await admin
        .from('estate_health_scores')
        .select('score, component_scores, computed_at')
        .eq('household_id', household.id)
        .maybeSingle()
    : { data: null }

  const estateHealthScore = mapEstateHealthScore(healthScoreRow)

  // ── Base case (projection rows) — same source as My Estate Strategy ──────
  const baseCaseRows: YearRow[] = baseCaseScenario?.outputs_s1_first ?? []

  // ── Conflict detector — read from cache, recomputed async on staleness ───
  // detectConflicts writes to DB — never call it in render path.
  const { data: conflictRows } = household?.id
    ? await admin
        .from('beneficiary_conflicts')
        .select('conflict_type, severity, asset_id, real_estate_id, description, recommended_action')
        .eq('household_id', household.id)
    : { data: null }

  const conflictReport = mapConflictReport(conflictRows)

  // ── RMD Status for current year ──────────────────────────────────────

  const { taxDeferredAssets, currentYearWithdrawals } = await loadDashboardRmdInputs(
    supabase,
    user!.id,
  )

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

  // ── Allocation context ───────────────────────────────────────────────────
  const allocationContext: AssetAllocationContext = buildAllocationContext({
    profile,
    household,
  })

  return (
    <DashboardClient
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
      allocationContext={allocationContext}
      retirementSnapshot={retirementSnapshot}
      retirementAccountsTotal={retirementAccountsTotal}
      estateHealthScore={estateHealthScore}
      conflictReport={conflictReport}
      setupSteps={setupSteps}
      completedSteps={completedSteps}
      progressPct={progressPct}
      userId={user!.id}
      householdId={household?.id ?? null}
      hasBaseCase={!!household?.base_case_scenario_id}
      scenarioId={household?.base_case_scenario_id ?? null}
      completionScore={completionScore}
      consumerTier={profile?.consumer_tier ?? 1}
      isAdvisor={profile?.role === 'advisor'}
      rmdStatus={rmdStatus}
      mortgageBalance={totalMortgageBalance}
      otherLiabilities={otherLiabilities}
      initialRecommendations={initialRecommendations}
      advisorStrategyItems={(advisorStrategyItems ?? []).map((item) => ({
        id: item.id,
        strategy_source: item.strategy_source,
        amount: Number(item.amount ?? 0),
        sign: typeof item.sign === 'number' ? item.sign : -1,
        scenario_name: item.scenario_name ?? null,
        consumer_accepted: item.consumer_accepted ?? false,
        consumer_rejected: item.consumer_rejected ?? false,
      }))}
      acceptedMCScenario={acceptedMCScenario}
      latestSharedMCScenario={latestSharedMCScenario}
      estateCallout={estateCallout}
    />
  )
}

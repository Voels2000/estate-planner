// ─────────────────────────────────────────
// Menu: Dashboard
// Route: /dashboard
// ─────────────────────────────────────────

import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
import Link from 'next/link'
import type { ConflictReport } from '@/lib/conflict-detector'
import type { EstateHealthScore } from '@/lib/estate-health-score'
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
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { DashboardClient } from '../_dashboard-client'

type HealthComponentLike = {
  label?: string
  score?: number
  maxScore?: number
  actionLabel?: string
  actionHref?: string
}

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
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🏡</div>
          <p className="text-sm font-medium text-neutral-700">My Estate Plan is not set up yet</p>
          <p className="mt-1 text-xs text-neutral-500">
            We could not find a household profile for this account. Complete your profile to create your estate plan workspace.
          </p>
          <div className="mt-4">
            <Link href="/profile" className="text-sm text-indigo-600 hover:underline">
              Complete profile setup →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()

  // Background staleness check for base-case projection:
  // regenerate asynchronously when user inputs or tax brackets are newer than the last run.
  const { data: baseCaseCalcRow } = household.base_case_scenario_id
    ? await admin
        .from('projection_scenarios')
        .select('calculated_at')
        .eq('id', household.base_case_scenario_id)
        .single()
    : { data: null }
  const projectionCalculatedAt = baseCaseCalcRow?.calculated_at ?? null
  const projectionCalculatedMs = projectionCalculatedAt ? new Date(projectionCalculatedAt).getTime() : 0

  const getLatestChangeTs = async (
    table: string,
    ownerColumn: string,
    ownerValue: string,
  ): Promise<string | null> => {
    const { data } = await supabase
      .from(table)
      .select('updated_at, created_at')
      .eq(ownerColumn, ownerValue)
      .order('updated_at', { ascending: false })
      .limit(1)
    const row = (data?.[0] ?? null) as { updated_at?: string | null; created_at?: string | null } | null
    return row?.updated_at ?? row?.created_at ?? null
  }

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
  ] = await Promise.all([
    getLatestChangeTs('assets', 'owner_id', user!.id),
    getLatestChangeTs('liabilities', 'owner_id', user!.id),
    getLatestChangeTs('income', 'owner_id', user!.id),
    getLatestChangeTs('expenses', 'owner_id', user!.id),
    getLatestChangeTs('real_estate', 'owner_id', user!.id),
    getLatestChangeTs('businesses', 'owner_id', user!.id),
    getLatestChangeTs('business_interests', 'owner_id', user!.id),
    getLatestChangeTs('insurance_policies', 'user_id', user!.id),
    (async () => {
      const { data } = await supabase
        .from('state_income_tax_brackets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = (data?.[0] ?? null) as { created_at?: string | null } | null
      return row?.created_at ?? null
    })(),
  ])

  const latestInputChangeMs = [
    household.updated_at ?? null,
    assetsChangedAt,
    liabilitiesChangedAt,
    incomeChangedAt,
    expensesChangedAt,
    realEstateChangedAt,
    businessesChangedAt,
    businessInterestsChangedAt,
    insuranceChangedAt,
    stateIncomeTaxBracketsChangedAt,
  ].reduce((max, ts) => {
    if (!ts) return max
    const ms = new Date(ts).getTime()
    return Number.isFinite(ms) ? Math.max(max, ms) : max
  }, 0)

  const isStale =
    !household.base_case_scenario_id ||
    !projectionCalculatedAt ||
    latestInputChangeMs > projectionCalculatedMs

  if (isStale) {
    void (async () => {
      try {
        const { generateBaseCase } = await import('@/lib/actions/generate-base-case')
        await generateBaseCase(household.id)
        const { triggerEstateHealthRecompute } = await import('@/lib/estate/triggerEstateHealthRecompute')
        triggerEstateHealthRecompute(household.id, process.env.NEXT_PUBLIC_APP_URL ?? '')
      } catch (e) {
        console.error('[dashboard] background base case regeneration failed', e)
      }
    })()
  }

  const { data: baseCaseScenario } = household?.base_case_scenario_id
    ? await admin
        .from('projection_scenarios')
        .select('outputs_s1_first, assumption_snapshot')
        .eq('id', household.base_case_scenario_id)
        .single()
    : { data: null }

  // ── Parallel data fetch ──────────────────────────────────────────────────
  // Income query now includes ALL sources (including social_security) so the
  // current-year net income calculation is complete.
  const [
    { data: profile },
    { data: assets },
    { data: liabilities },
    { data: income },           // ALL sources including SS rows if entered manually
    { data: expenses },
    { data: realEstate },
    { data: businesses },
    { data: businessInterests },
    { data: insurance },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('assets').select('value').eq('owner_id', user!.id),
    supabase.from('liabilities').select('balance').eq('owner_id', user!.id),
    // Removed .neq('source', 'social_security') — include all income sources
    supabase.from('income').select('amount, source, start_year, end_year').eq('owner_id', user!.id),
    supabase.from('expenses').select('amount').eq('owner_id', user!.id),
    supabase.from('real_estate').select('current_value, mortgage_balance, monthly_payment, titling').eq('owner_id', user!.id),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', user!.id),
    supabase
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', user!.id),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', user!.id),
  ])

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

  // ── Tier / completion ────────────────────────────────────────────────────
  const isConsumerTier2 = profile?.role === 'consumer' && (profile?.consumer_tier ?? 1) === 2
  const [completionScore, composition] = await Promise.all([
    isConsumerTier2 ? getCompletionScore(user!.id) : Promise.resolve(null),
    household?.id ? classifyEstateAssets(supabase, household.id) : Promise.resolve(null),
  ])

  // ── Financial calculations (engine-aligned primary path) ─────────────────
  // Use composition rollups so Dashboard net worth matches estate engine:
  // gross estate at FMV minus total liabilities.
  const financialAssets = composition?.inside_financial ?? financialAssetsFallback
  const realEstateFMV = composition?.inside_real_estate ?? realEstateEquityFallback
  const businessValue = composition?.inside_business_gross ?? businessValueFallback
  const insuranceValue = composition?.inside_insurance ?? insuranceValueFallback
  void insuranceValue
  const totalAssets = financialAssets + realEstateFMV + businessValue
  const otherLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const totalLiabilities = totalMortgageBalance + otherLiabilities
  const netWorth = totalAssets - totalLiabilities

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

  const estateHealthScore: EstateHealthScore | null = healthScoreRow
    ? {
        score: healthScoreRow.score ?? 0,
        components: Object.entries(healthScoreRow.component_scores ?? {}).map(
          ([key, rawVal]: [string, unknown]) => {
            const val: HealthComponentLike =
              rawVal && typeof rawVal === 'object' ? (rawVal as HealthComponentLike) : {}
            return ({
            key,
            label: val.label ?? key,
            score: val.score ?? 0,
            maxScore: val.maxScore ?? 0,
            status: (val.score ?? 0) >= (val.maxScore ?? 1)
              ? 'good'
              : (val.score ?? 0) >= (val.maxScore ?? 1) * 0.5
              ? 'warning'
              : 'critical',
            actionLabel: val.actionLabel ?? '',
            actionHref: val.actionHref ?? '/health-check',
            })
          },
        ),
        computedAt: healthScoreRow.computed_at ?? new Date().toISOString(),
      }
    : null

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

  const conflictReport: ConflictReport | null = conflictRows
    ? {
        conflicts: conflictRows,
        critical: conflictRows.filter(c => c.severity === 'critical').length,
        warnings: conflictRows.filter(c => c.severity === 'warning').length,
        computedAt: new Date().toISOString(),
      }
    : null

  // ── RMD Status for current year ──────────────────────────────────────

  const { data: taxDeferredAssets } = await supabase
    .from('assets')
    .select('value, owner, type')
    .eq('owner_id', user!.id)
    .in('type', [
      'traditional_401k', 'traditional_ira', '401k', 'ira',
      'traditional_403b', 'sep_ira', 'simple_ira', '457', 'sep',
    ])

  const { data: currentYearWithdrawals } = await supabase
    .from('income')
    .select('amount, source, ss_person, start_year, end_year')
    .eq('owner_id', user!.id)
    .in('source', ['traditional_401k', 'traditional_ira'])

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

  const retirementSnapshot = hasRetirementInputs ? {
    p1Name: household?.person1_name != null ? displayPersonFirstName(household.person1_name) : null,
    p1RetirementAge,
    p1SSClaimingAge,
    p1MonthlyBenefit,
    p1BirthYear,
    p2Name: hasSpouse && household?.person2_name != null ? displayPersonFirstName(household.person2_name) : null,
    p2RetirementAge: hasSpouse ? p2RetirementAge : null,
    p2SSClaimingAge: hasSpouse ? p2SSClaimingAge2 : null,
    p2MonthlyBenefit: hasSpouse ? p2MonthlyBenefit : null,
    hasSpouse,
    yearsToRetirement,
    combinedSSMonthly,
    projectedAnnualIncome,
    projectedAnnualExpenses,
    projectedIncomeGap,
  } : null

  // ── Allocation context ───────────────────────────────────────────────────
  const allocationContext: AssetAllocationContext = {
    currentAge: profile?.current_age ?? null,
    birthYear: household?.person1_birth_year ?? null,
    riskTolerance: household?.risk_tolerance ?? profile?.risk_tolerance ?? null,
    retirementAge: profile?.retirement_age ?? household?.person1_retirement_age ?? null,
    maritalStatus: profile?.marital_status ?? null,
    dependents: profile?.dependents ?? null,
    hasSpouse: household?.has_spouse ?? null,
    filingStatus: household?.filing_status != null ? String(household.filing_status) : null,
  }

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
    />
  )
}

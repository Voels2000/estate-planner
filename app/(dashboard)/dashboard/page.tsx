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

// ── SS benefit adjustment for claiming age vs FRA ────────────────────────────
// FRA = 67 for born 1960+. Early = -6.67%/yr (first 3yr) then -5%/yr.
// Delayed past FRA = +8%/yr up to age 70.
function adjustSSForClaimingAge(pia: number, claimingAge: number, birthYear: number): number {
  if (!pia || !claimingAge) return pia ?? 0
  const fra = birthYear >= 1960 ? 67 : 66
  const diff = claimingAge - fra
  if (diff === 0) return pia
  if (diff > 0) return Math.round(pia * (1 + Math.min(diff, 3) * 0.08))
  const early = Math.abs(diff)
  const first3 = Math.min(early, 3) * (1 / 15)
  const beyond = Math.max(early - 3, 0) * (1 / 20)
  return Math.round(pia * (1 - first3 - beyond))
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
      <div className="mx-auto max-w-5xl px-4 py-12">
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

  // Current year income from income table (all sources, date-filtered)
  const totalIncomeFromTable = (income ?? []).reduce((s, i) => {
    if (i.start_year && i.start_year > currentYear) return s
    if (i.end_year && i.end_year < currentYear) return s
    return s + Number(i.amount)
  }, 0)

  // SS income from household PIA fields (canonical source — projection engine uses these)
  // Only add SS from PIA if NOT already in the income table to avoid double-counting
  const hasSSInIncomeTable = (income ?? []).some(i => i.source === 'social_security')

  const p1BirthYear = household?.person1_birth_year ?? null
  const p1SSClaimingAge = household?.person1_ss_claiming_age ?? null
  const p1SSPia = household?.person1_ss_pia ? Number(household.person1_ss_pia) : null
  const p2BirthYear = household?.person2_birth_year ?? null
  const p2SSClaimingAge = household?.person2_ss_claiming_age ?? null
  const p2SSPia = household?.person2_ss_pia ? Number(household.person2_ss_pia) : null
  const hasSpouse = household?.has_spouse ?? false

  const p1MonthlyBenefit = p1SSPia && p1SSClaimingAge && p1BirthYear
    ? adjustSSForClaimingAge(p1SSPia, p1SSClaimingAge, p1BirthYear)
    : p1SSPia ?? null

  const p2MonthlyBenefit = hasSpouse && p2SSPia && p2SSClaimingAge && p2BirthYear
    ? adjustSSForClaimingAge(p2SSPia, p2SSClaimingAge, p2BirthYear)
    : hasSpouse ? (p2SSPia ?? null) : null

  // combinedSSMonthly = full future SS value — used in retirement snapshot display
  const combinedSSMonthly = (p1MonthlyBenefit ?? 0) + (p2MonthlyBenefit ?? 0)

  // Age gate — only include SS in current year income if the person
  // has reached their claiming age this year or earlier.
  const p1CurrentAge = p1BirthYear ? currentYear - p1BirthYear : null
  const p2CurrentAge = p2BirthYear ? currentYear - p2BirthYear : null
  const p1IsClaimingNow = p1CurrentAge !== null && p1SSClaimingAge !== null && p1CurrentAge >= p1SSClaimingAge
  const p2IsClaimingNow = hasSpouse && p2CurrentAge !== null && p2SSClaimingAge !== null && p2CurrentAge >= p2SSClaimingAge

  // annualSSFromPIA = SS actually in payment today (age-gated for current year net)
  const annualSSFromPIA =
    ((p1IsClaimingNow ? (p1MonthlyBenefit ?? 0) : 0) +
     (p2IsClaimingNow ? (p2MonthlyBenefit ?? 0) : 0)) * 12

  // Total income = table income + age-gated SS (if not already in income table)
  const totalIncome = hasSSInIncomeTable
    ? totalIncomeFromTable
    : totalIncomeFromTable + annualSSFromPIA

  const annualMortgagePayments = (realEstate ?? [])
    .filter(re => Number(re.mortgage_balance ?? 0) > 0 && Number(re.monthly_payment ?? 0) > 0)
    .reduce((s, re) => s + Number(re.monthly_payment) * 12, 0)
  const totalMortgageBalance = (realEstate ?? []).reduce((s, re) => s + Number(re.mortgage_balance ?? 0), 0)

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0) + annualMortgagePayments
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0

  // Current year net = total income (all sources incl SS) - total expenses
  // This is the live metric — updates as income/expense data changes.
  // E.g. when expenses drop $110K in 2030 after moving, this reflects it.
  const currentYearNet = totalIncome - totalExpenses
  // Derive from baseCaseScenario already loaded above — no HTTP roundtrip needed
  const hasLiveProjectionOutput =
    Array.isArray(baseCaseScenario?.outputs_s1_first) &&
    (baseCaseScenario.outputs_s1_first as unknown[]).length > 0

  // ── Setup steps — "Compare scenarios" removed (no longer a gate) ─────────
  const setupSteps = [
    { key: 'profile', label: 'Complete your profile', href: '/profile', done: !!(household?.person1_name && household?.person1_birth_year) },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: (assets ?? []).length > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: (liabilities ?? []).length > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: (income ?? []).length > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: (expenses ?? []).length > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: hasLiveProjectionOutput },
  ]
  const completedSteps = setupSteps.filter(s => s.done).length
  const progressPct = Math.round((completedSteps / setupSteps.length) * 100)

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
  function getRmdStartAge(birthYear: number): number {
    if (birthYear >= 1960) return 75
    if (birthYear >= 1951) return 73
    return 72
  }

  function getRmdFactor(age: number): number {
    return Math.max(1, 27.4 - (age - 72))
  }

  function calcRmdAmount(age: number, balance: number, birthYear: number): number {
    const rmdAge = getRmdStartAge(birthYear)
    if (age < rmdAge || balance <= 0) return 0
    return Math.round(balance / getRmdFactor(age))
  }

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

  const p1TaxDeferred = (taxDeferredAssets ?? [])
    .filter(a => a.owner === 'person1' ||
      a.owner === (household?.person1_name ?? '').trim().toLowerCase())
    .reduce((s, a) => s + Number(a.value), 0)

  const p2TaxDeferred = hasSpouse ? (taxDeferredAssets ?? [])
    .filter(a => a.owner === 'person2' ||
      a.owner === (household?.person2_name ?? '').trim().toLowerCase())
    .reduce((s, a) => s + Number(a.value), 0) : 0

  const p1AgeNow = p1BirthYear ? currentYear - p1BirthYear : null
  const p2AgeNow = p2BirthYear ? currentYear - p2BirthYear : null

  const p1RmdRequired = p1AgeNow && p1BirthYear
    ? calcRmdAmount(p1AgeNow, p1TaxDeferred, p1BirthYear) : 0

  const p2RmdRequired = p2AgeNow && p2BirthYear && hasSpouse
    ? calcRmdAmount(p2AgeNow, p2TaxDeferred, p2BirthYear) : 0

  const activeWithdrawals = (currentYearWithdrawals ?? []).filter(w => {
    if (w.start_year && w.start_year > currentYear) return false
    if (w.end_year && w.end_year < currentYear) return false
    return true
  })

  const p1RmdPlanned = activeWithdrawals
    .filter(w => w.ss_person === 'person1')
    .reduce((s, w) => s + Number(w.amount), 0)

  const p2RmdPlanned = activeWithdrawals
    .filter(w => w.ss_person === 'person2')
    .reduce((s, w) => s + Number(w.amount), 0)

  const rmdStatus = {
    p1Name: displayPersonFirstName(household?.person1_name, 'Person 1'),
    p2Name: hasSpouse
      ? displayPersonFirstName(household?.person2_name, 'Person 2')
      : null,
    p1Required: p1RmdRequired,
    p1Planned: p1RmdPlanned,
    p1StartYear: p1BirthYear ? p1BirthYear + getRmdStartAge(p1BirthYear) : null,
    p2Required: p2RmdRequired,
    p2Planned: p2RmdPlanned,
    p2StartYear: p2BirthYear && hasSpouse
      ? p2BirthYear + getRmdStartAge(p2BirthYear)
      : null,
    hasSpouse,
  }

  // ── Retirement snapshot — from households table ──────────────────────────
  const p1RetirementAge = household?.person1_retirement_age ?? null
  const p2RetirementAge = household?.person2_retirement_age ?? null
  const p2SSClaimingAge2 = household?.person2_ss_claiming_age ?? null

  const currentAge = p1BirthYear ? currentYear - p1BirthYear : null
  const yearsToRetirement = p1RetirementAge && currentAge ? Math.max(0, p1RetirementAge - currentAge) : null

  // If base case exists, find retirement year row for projected income at retirement
  let projectedAnnualIncome: number | null = null
  let projectedAnnualExpenses: number | null = null
  let projectedIncomeGap: number | null = null

  if (baseCaseRows.length > 0 && p1BirthYear && p1RetirementAge) {
    const retirementYear = p1BirthYear + p1RetirementAge

    // Use the FIRST FULL retirement year (retirementYear + 1) rather than
    // the transition year itself. The transition year blends working and
    // retired income making it an unreliable snapshot.
    // Fall back to the retirement year itself if +1 is not in the projection.
    const firstFullRetirementYear = retirementYear + 1
    const retirementRow =
      baseCaseRows.find(r => r.year === firstFullRetirementYear)
      ?? baseCaseRows.find(r => r.year === retirementYear)
      ?? baseCaseRows.find(r => (r.age_person1 ?? 0) >= p1RetirementAge)

    if (retirementRow) {
      // Use income_total from projection — already includes SS, RMD,
      // and all other income correctly for that year
      projectedAnnualIncome = retirementRow.income_total ?? 0
      projectedAnnualExpenses = retirementRow.expenses_total ?? totalExpenses
      projectedIncomeGap = projectedAnnualIncome - projectedAnnualExpenses
    }
  }

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
    combinedSSMonthly: combinedSSMonthly > 0 ? combinedSSMonthly : null,
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

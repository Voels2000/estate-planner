import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { detectConflicts } from '@/lib/conflict-detector'
import { computeEstateHealthScore, type EstateHealthScore } from '@/lib/estate-health-score'
import { getCompletionScore, type CompletionScore } from '@/lib/get-completion-score'
import { computeEstateTaxProjection } from '@/lib/calculations/estate-tax-projection'
import type { YearRow } from '@/lib/calculations/projection-complete'
import { calculateStateEstateTax, parseStateTaxCode } from '@/lib/projection/stateRegistry'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '../_dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  // ── Parallel data fetch ──────────────────────────────────────────────────
  const [
    { data: profile },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: projections },
    { data: realEstate },
    { data: businesses },
    { data: insurance },
    // Retirement-specific tables
    { data: ssScenarios },
    { data: retirementIncome },
    { data: monteCarloBestRow },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('assets').select('value').eq('owner_id', user!.id),
    supabase.from('liabilities').select('balance').eq('owner_id', user!.id),
    supabase.from('income')
      .select('amount, start_year, end_year')
      .eq('owner_id', user!.id)
      .neq('source', 'social_security'),
    supabase.from('expenses').select('amount').eq('owner_id', user!.id),
    household?.id
      ? supabase.from('projections').select('summary').eq('household_id', household.id).limit(1)
      : Promise.resolve({ data: [] }),
    supabase.from('real_estate').select('current_value, mortgage_balance').eq('owner_id', user!.id),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', user!.id),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', user!.id),

    // SS claiming scenarios — pick the "selected" or highest-benefit row
    supabase
      .from('ss_scenarios')
      .select('claiming_age, monthly_benefit, is_selected')
      .eq('owner_id', user!.id)
      .order('is_selected', { ascending: false })
      .order('monthly_benefit', { ascending: false })
      .limit(5),

    // Retirement income view (includes SS + RMD blended) — used for income gap
    supabase
      .from('retirement_income_summary')
      .select('annual_income, annual_expenses, income_gap, retirement_age')
      .eq('owner_id', user!.id)
      .maybeSingle(),

    // Monte Carlo results — pick latest run's success probability
    household?.id
      ? supabase
          .from('monte_carlo_results')
          .select('success_probability, created_at')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ])

  // ── Financial calculations ───────────────────────────────────────────────
  const financialAssets = (assets ?? []).reduce((sum, a) => sum + Number(a.value), 0)
  const realEstateEquity = (realEstate ?? []).reduce(
    (sum, r) => sum + Number(r.current_value) - Number(r.mortgage_balance ?? 0),
    0,
  )
  const businessValue = (businesses ?? []).reduce((sum, b) => {
    const pct = Number(b.ownership_pct ?? 100) / 100
    return sum + Number(b.estimated_value) * pct
  }, 0)
  const insuranceValue = (insurance ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((sum, p) => sum + Number(p.death_benefit ?? 0), 0)

  const totalAssets = financialAssets + realEstateEquity + businessValue + insuranceValue
  const totalLiabilities = (liabilities ?? []).reduce((sum, l) => sum + Number(l.balance), 0)
  const netWorth = totalAssets - totalLiabilities

  const currentYear = new Date().getFullYear()
  const totalIncome = (income ?? []).reduce((sum, i) => {
    if (i.start_year && i.start_year > currentYear) return sum
    if (i.end_year && i.end_year < currentYear) return sum
    return sum + Number(i.amount)
  }, 0)
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0

  // ── Setup steps ─────────────────────────────────────────────────────────
  const setupSteps = [
    {
      key: 'profile',
      label: 'Complete your profile',
      href: '/profile',
      done: !!(household?.person1_name && household?.person1_birth_year),
    },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: (assets ?? []).length > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: (liabilities ?? []).length > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: (income ?? []).length > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: (expenses ?? []).length > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: (projections ?? []).length > 0 },
    { key: 'scenarios', label: 'Compare scenarios', href: '/scenarios', done: false },
  ]
  const completedSteps = setupSteps.filter((s) => s.done).length
  const progressPct = Math.round((completedSteps / setupSteps.length) * 100)

  // ── Tier / completion ────────────────────────────────────────────────────
  const isConsumerTier2 = profile?.role === 'consumer' && (profile?.consumer_tier ?? 1) === 2
  const completionScore: CompletionScore | null = isConsumerTier2
    ? await getCompletionScore(user!.id)
    : null

  // ── Estate health score ──────────────────────────────────────────────────
  const estateHealthScore: EstateHealthScore | null = household?.id
    ? await computeEstateHealthScore(household.id, user!.id)
    : null

  // ── Base case / tax projection ───────────────────────────────────────────
  const { data: baseCaseScenario } = household?.base_case_scenario_id
    ? await supabase
        .from('projection_scenarios')
        .select('outputs_s1_first, assumption_snapshot')
        .eq('id', household.base_case_scenario_id)
        .single()
    : { data: null }

  const baseCaseRows = baseCaseScenario?.outputs_s1_first ?? []
  const finalRow = baseCaseRows[baseCaseRows.length - 1]
  const grossAtDeath = finalRow?.estate_incl_home ?? 0

  // Sunset tax config
  const { data: sunsetTaxConfig } = await supabase
    .from('federal_tax_config')
    .select('*')
    .eq('scenario_id', 'sunset_2026')
    .eq('is_active', true)
    .maybeSingle()

  let sunsetFederalTax = 0
  if (household && baseCaseRows.length > 0 && sunsetTaxConfig) {
    const filingStatus =
      household.filing_status === 'mfj' || household.filing_status === 'married_filing_jointly'
        ? 'mfj'
        : 'single'
    const { s1_first } = computeEstateTaxProjection(
      baseCaseRows as YearRow[],
      sunsetTaxConfig,
      filingStatus,
      household.has_spouse ?? false,
      household.person1_birth_year ?? 1960,
      household.person1_longevity_age ?? 90,
      household.person2_birth_year ?? null,
      household.person2_longevity_age ?? null,
      0,
    )
    sunsetFederalTax = s1_first.estate_tax_federal
  }

  // Current law exemption
  const { data: taxConfig } = await supabase
    .from('federal_tax_config')
    .select('estate_exemption_individual, estate_top_rate_pct')
    .eq('scenario_id', 'current_law_extended')
    .single()

  const exemption = taxConfig?.estate_exemption_individual ?? 13_610_000
  const alertYear = finalRow?.year ?? currentYear

  const { stateTax } = household
    ? calculateStateEstateTax({
        grossEstate: grossAtDeath,
        stateCode: parseStateTaxCode(household.state_primary),
        year: alertYear,
        federalExemption: exemption,
      })
    : { stateTax: 0 }

  // ── Conflict detector ────────────────────────────────────────────────────
  // Titling conflicts only — NY cliff / ILIT / gifting gap come from AlertCenter
  const conflictReport = household?.id ? await detectConflicts(household.id, user!.id) : null

  // ── Retirement snapshot ──────────────────────────────────────────────────
  // SS — prefer is_selected row, fall back to highest benefit
  const selectedSS = ssScenarios?.find((s) => s.is_selected) ?? ssScenarios?.[0] ?? null

  // Retirement age: prefer retirement_income_summary, fall back to profile / household
  const retirementAge: number | null =
    retirementIncome?.retirement_age ??
    profile?.retirement_age ??
    household?.person1_retirement_age ??
    null

  const person1BirthYear: number | null = household?.person1_birth_year ?? null
  const currentAge = person1BirthYear ? currentYear - person1BirthYear : null
  const yearsToRetirement =
    retirementAge && currentAge ? Math.max(0, retirementAge - currentAge) : null

  // Income gap from retirement_income_summary view (negative = shortfall)
  const projectedIncomeGap: number | null =
    retirementIncome?.income_gap != null ? Number(retirementIncome.income_gap) : null

  // Monte Carlo success probability
  const monteCarloProbability: number | null =
    Array.isArray(monteCarloBestRow) && monteCarloBestRow.length > 0
      ? Number((monteCarloBestRow as Array<{ success_probability: number }>)[0].success_probability)
      : null

  // Check if lifetime snapshot page has data (projections exist = yes)
  const hasLifetimeSnapshot = (projections ?? []).length > 0

  const retirementSnapshot =
    selectedSS || retirementAge || projectedIncomeGap !== null
      ? {
          retirementAge,
          yearsToRetirement,
          ssBenefitMonthly: selectedSS?.monthly_benefit ? Number(selectedSS.monthly_benefit) : null,
          ssClaimingAge: selectedSS?.claiming_age ? Number(selectedSS.claiming_age) : null,
          projectedIncomeGap,
          monteCarloProbability,
          hasLifetimeSnapshot,
        }
      : null

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

  const householdName =
    [household?.person1_first_name, household?.person1_last_name].filter(Boolean).join(' ').trim() ||
    (typeof household?.person1_name === 'string' ? household.person1_name.trim() : '') ||
    undefined

  void householdName // available for future use

  return (
    <DashboardClient
      userName={profile?.full_name ?? user!.email ?? ''}
      // Financial
      totalAssets={totalAssets}
      totalLiabilities={totalLiabilities}
      netWorth={netWorth}
      netWorthBySource={{
        financial: financialAssets,
        realEstateEquity,
        business: businessValue,
        insurance: insuranceValue,
      }}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      savingsRate={savingsRate}
      allocationContext={allocationContext}
      // Retirement
      retirementSnapshot={retirementSnapshot}
      // Estate
      estateHealthScore={estateHealthScore}
      conflictReport={conflictReport}
      currentFederalTax={finalRow?.estate_tax_federal ?? 0}
      sunsetFederalTax={sunsetFederalTax}
      stateTax={stateTax}
      stateCode={household?.state_primary ?? undefined}
      // Setup / meta
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
    />
  )
}

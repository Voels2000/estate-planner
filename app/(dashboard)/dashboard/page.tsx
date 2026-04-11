import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { detectConflicts } from '@/lib/conflict-detector'
import { computeEstateHealthScore, type EstateHealthScore } from '@/lib/estate-health-score'
import { getCompletionScore, type CompletionScore } from '@/lib/get-completion-score'
import { computeEstateTaxProjection } from '@/lib/calculations/estate-tax-projection'
import type { YearRow } from '@/lib/calculations/projection-complete'
import { calculateStateEstateTax, parseStateTaxCode } from '@/lib/projection/stateRegistry'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '../_dashboard-client'

// ── SS benefit adjustment for claiming age vs FRA ────────────────────────────
// FRA = 67 for anyone born 1960+. Each year early = -6.67%/yr (up to 3yr) then -5%/yr.
// Each year delayed past FRA = +8%/yr up to age 70.
function adjustSSForClaimingAge(pia: number, claimingAge: number, birthYear: number): number {
  if (!pia || !claimingAge) return pia ?? 0
  const fra = birthYear >= 1960 ? 67 : 66 // simplified
  const diff = claimingAge - fra
  if (diff === 0) return pia
  if (diff > 0) return Math.round(pia * (1 + Math.min(diff, 3) * 0.08)) // delayed credits
  const early = Math.abs(diff)
  const first3 = Math.min(early, 3) * (1 / 15) // 6.67%/yr = 5/9 % per month
  const beyond = Math.max(early - 3, 0) * (1 / 20) // 5%/yr = 5/12 % per month
  return Math.round(pia * (1 - first3 - beyond))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  // ── Parallel data fetch ──────────────────────────────────────────────────
  // No separate retirement table queries needed — all retirement inputs
  // are on the households table (person1/2 PIA, claiming age, retirement age).
  // Projection rows give us the actual computed SS + RMD values at retirement.
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
    supabase.from('real_estate').select('current_value, mortgage_balance, titling').eq('owner_id', user!.id),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', user!.id),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', user!.id),
  ])

  // ── Financial calculations ───────────────────────────────────────────────
  const financialAssets = (assets ?? []).reduce((s, a) => s + Number(a.value), 0)
  const realEstateEquity = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value) - Number(r.mortgage_balance ?? 0), 0,
  )
  const businessValue = (businesses ?? []).reduce((s, b) => {
    return s + Number(b.estimated_value) * (Number(b.ownership_pct ?? 100) / 100)
  }, 0)
  const insuranceValue = (insurance ?? [])
    .filter(p => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const totalAssets = financialAssets + realEstateEquity + businessValue + insuranceValue
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const netWorth = totalAssets - totalLiabilities

  const currentYear = new Date().getFullYear()
  const totalIncome = (income ?? []).reduce((s, i) => {
    if (i.start_year && i.start_year > currentYear) return s
    if (i.end_year && i.end_year < currentYear) return s
    return s + Number(i.amount)
  }, 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0

  // ── Setup steps ─────────────────────────────────────────────────────────
  const setupSteps = [
    { key: 'profile', label: 'Complete your profile', href: '/profile', done: !!(household?.person1_name && household?.person1_birth_year) },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: (assets ?? []).length > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: (liabilities ?? []).length > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: (income ?? []).length > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: (expenses ?? []).length > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: (projections ?? []).length > 0 },
    { key: 'scenarios', label: 'Compare scenarios', href: '/scenarios', done: false },
  ]
  const completedSteps = setupSteps.filter(s => s.done).length
  const progressPct = Math.round((completedSteps / setupSteps.length) * 100)

  // ── Tier / completion ────────────────────────────────────────────────────
  const isConsumerTier2 = profile?.role === 'consumer' && (profile?.consumer_tier ?? 1) === 2
  const completionScore: CompletionScore | null = isConsumerTier2 ? await getCompletionScore(user!.id) : null

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

  const baseCaseRows: YearRow[] = baseCaseScenario?.outputs_s1_first ?? []
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
    const filingStatus = household.filing_status === 'mfj' || household.filing_status === 'married_filing_jointly' ? 'mfj' : 'single'
    const { s1_first } = computeEstateTaxProjection(
      baseCaseRows,
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
  const conflictReport = household?.id ? await detectConflicts(household.id, user!.id) : null

  // ── Retirement snapshot — computed from households table ─────────────────
  // All retirement inputs live on households: person1/2 PIA, claiming age,
  // retirement age, birth year. No separate SS table needed.
  // If base case exists, use the actual projection row at retirement year
  // for SS and RMD values (already computed by projection engine).

  const p1BirthYear = household?.person1_birth_year ?? null
  const p1RetirementAge = household?.person1_retirement_age ?? null
  const p1SSClaimingAge = household?.person1_ss_claiming_age ?? null
  const p1SSPia = household?.person1_ss_pia ? Number(household.person1_ss_pia) : null

  const p2BirthYear = household?.person2_birth_year ?? null
  const p2RetirementAge = household?.person2_retirement_age ?? null
  const p2SSClaimingAge = household?.person2_ss_claiming_age ?? null
  const p2SSPia = household?.person2_ss_pia ? Number(household.person2_ss_pia) : null
  const hasSpouse = household?.has_spouse ?? false

  const currentAge = p1BirthYear ? currentYear - p1BirthYear : null
  const yearsToRetirement = p1RetirementAge && currentAge ? Math.max(0, p1RetirementAge - currentAge) : null

  // Adjust PIA for claiming age to get actual monthly benefit
  const p1MonthlyBenefit = p1SSPia && p1SSClaimingAge && p1BirthYear
    ? adjustSSForClaimingAge(p1SSPia, p1SSClaimingAge, p1BirthYear)
    : p1SSPia ?? null

  const p2MonthlyBenefit = hasSpouse && p2SSPia && p2SSClaimingAge && p2BirthYear
    ? adjustSSForClaimingAge(p2SSPia, p2SSClaimingAge, p2BirthYear)
    : hasSpouse ? (p2SSPia ?? null) : null

  // Combined monthly SS at retirement
  const combinedSSMonthly = (p1MonthlyBenefit ?? 0) + (p2MonthlyBenefit ?? 0)

  // If base case projection exists, find the retirement year row for RMD data
  // and actual computed SS values (more accurate than PIA adjustment above)
  let projectedAnnualIncome: number | null = null
  let projectedAnnualExpenses: number | null = null
  let projectedIncomeGap: number | null = null

  if (baseCaseRows.length > 0 && p1BirthYear && p1RetirementAge) {
    const retirementYear = p1BirthYear + p1RetirementAge
    const retirementRow = baseCaseRows.find(r => r.year === retirementYear)
      ?? baseCaseRows.find(r => (r.age_person1 ?? 0) >= p1RetirementAge)

    if (retirementRow) {
      const ss1 = retirementRow.income_ss_person1 ?? 0
      const ss2 = retirementRow.income_ss_person2 ?? 0
      const rmd1 = retirementRow.income_rmd_p1 ?? 0
      const rmd2 = retirementRow.income_rmd_p2 ?? 0
      const otherIncome = retirementRow.income_other_pooled ?? retirementRow.income_earned_p1 ?? 0
      projectedAnnualIncome = ss1 + ss2 + rmd1 + rmd2 + otherIncome
      projectedAnnualExpenses = retirementRow.expenses_total ?? totalExpenses
      projectedIncomeGap = projectedAnnualIncome - projectedAnnualExpenses
    }
  }

  // Only build snapshot if we have at least retirement age or SS data
  const hasRetirementInputs = !!(p1RetirementAge || p1SSPia || p2SSPia)

  const retirementSnapshot = hasRetirementInputs ? {
    // Person 1
    p1Name: household?.person1_name ?? null,
    p1RetirementAge,
    p1SSClaimingAge,
    p1MonthlyBenefit,
    p1BirthYear,
    // Person 2
    p2Name: hasSpouse ? (household?.person2_name ?? null) : null,
    p2RetirementAge: hasSpouse ? p2RetirementAge : null,
    p2SSClaimingAge: hasSpouse ? p2SSClaimingAge : null,
    p2MonthlyBenefit: hasSpouse ? p2MonthlyBenefit : null,
    hasSpouse,
    // Combined
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
      // Retirement — all from households table
      retirementSnapshot={retirementSnapshot}
      // Estate
      estateHealthScore={estateHealthScore}
      conflictReport={conflictReport}
      currentFederalTax={(finalRow as YearRow & { estate_tax_federal?: number })?.estate_tax_federal ?? 0}
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

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

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  // ── Parallel data fetch ──────────────────────────────────────────────────
  // Income query now includes ALL sources (including social_security) so the
  // current-year net income calculation is complete.
  const [
    { data: profile },
    { data: assets },
    { data: liabilities },
    { data: income },           // ALL sources including SS rows if entered manually
    { data: expenses },
    { data: projections },
    { data: realEstate },
    { data: businesses },
    { data: insurance },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('assets').select('value').eq('owner_id', user!.id),
    supabase.from('liabilities').select('balance').eq('owner_id', user!.id),
    // Removed .neq('source', 'social_security') — include all income sources
    supabase.from('income').select('amount, source, start_year, end_year').eq('owner_id', user!.id),
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
  const businessValue = (businesses ?? []).reduce((s, b) =>
    s + Number(b.estimated_value) * (Number(b.ownership_pct ?? 100) / 100), 0,
  )
  const insuranceValue = (insurance ?? [])
    .filter(p => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const totalAssets = financialAssets + realEstateEquity + businessValue + insuranceValue
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const netWorth = totalAssets - totalLiabilities

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

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0

  // Current year net = total income (all sources incl SS) - total expenses
  // This is the live metric — updates as income/expense data changes.
  // E.g. when expenses drop $110K in 2030 after moving, this reflects it.
  const currentYearNet = totalIncome - totalExpenses

  // ── Setup steps — "Compare scenarios" removed (no longer a gate) ─────────
  const setupSteps = [
    { key: 'profile', label: 'Complete your profile', href: '/profile', done: !!(household?.person1_name && household?.person1_birth_year) },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: (assets ?? []).length > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: (liabilities ?? []).length > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: (income ?? []).length > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: (expenses ?? []).length > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: (projections ?? []).length > 0 },
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
    const retirementRow = baseCaseRows.find(r => r.year === retirementYear)
      ?? baseCaseRows.find(r => (r.age_person1 ?? 0) >= p1RetirementAge)

    if (retirementRow) {
      const ss1 = retirementRow.income_ss_person1 ?? 0
      const ss2 = retirementRow.income_ss_person2 ?? 0
      const rmd1 = retirementRow.income_rmd_p1 ?? 0
      const rmd2 = retirementRow.income_rmd_p2 ?? 0
      const other = retirementRow.income_other_pooled ?? retirementRow.income_earned_p1 ?? 0
      projectedAnnualIncome = ss1 + ss2 + rmd1 + rmd2 + other
      projectedAnnualExpenses = retirementRow.expenses_total ?? totalExpenses
      projectedIncomeGap = projectedAnnualIncome - projectedAnnualExpenses
    }
  }

  const hasRetirementInputs = !!(p1RetirementAge || p1SSPia || p2SSPia)

  const retirementSnapshot = hasRetirementInputs ? {
    p1Name: household?.person1_name ?? null,
    p1RetirementAge,
    p1SSClaimingAge,
    p1MonthlyBenefit,
    p1BirthYear,
    p2Name: hasSpouse ? (household?.person2_name ?? null) : null,
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
      userName={profile?.full_name ?? user!.email ?? ''}
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
      currentYearNet={currentYearNet}
      annualSSFromPIA={annualSSFromPIA}
      allocationContext={allocationContext}
      retirementSnapshot={retirementSnapshot}
      estateHealthScore={estateHealthScore}
      conflictReport={conflictReport}
      currentFederalTax={(finalRow as YearRow & { estate_tax_federal?: number })?.estate_tax_federal ?? 0}
      sunsetFederalTax={sunsetFederalTax}
      stateTax={stateTax}
      stateCode={household?.state_primary ?? undefined}
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

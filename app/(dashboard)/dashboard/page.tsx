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

  const { data: household } = await supabase.from('households').select('*').eq('owner_id', user!.id).single()

  const [{ data: profile }, { data: assets }, { data: liabilities }, { data: income }, { data: expenses }, { data: projections }, { data: realEstate }, { data: businesses }, { data: insurance }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase.from('assets').select('value').eq('owner_id', user!.id),
      supabase.from('liabilities').select('balance').eq('owner_id', user!.id),
      supabase.from('income').select('amount, start_year, end_year').eq('owner_id', user!.id).neq('source', 'social_security'),
      supabase.from('expenses').select('amount').eq('owner_id', user!.id),
      household?.id ? supabase.from('projections').select('summary').eq('household_id', household.id).limit(1) : Promise.resolve({ data: [] }),
      supabase.from('real_estate').select('current_value').eq('owner_id', user!.id),
      supabase.from('businesses').select('estimated_value').eq('owner_id', user!.id),
      supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', user!.id),
    ])

  const totalAssets =
    (assets ?? []).reduce((sum, a) => sum + Number(a.value), 0) +
    (realEstate ?? []).reduce((sum, r) => sum + Number(r.current_value), 0) +
    (businesses ?? []).reduce((sum, b) => sum + Number(b.estimated_value), 0) +
    (insurance ?? []).filter(p => !p.is_ilit).reduce((sum, p) => sum + Number(p.death_benefit ?? 0), 0)
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

  const setupSteps = [
    { key: 'profile', label: 'Complete your profile', href: '/profile', done: !!(household?.person1_name && household?.person1_birth_year) },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: (assets ?? []).length > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: (liabilities ?? []).length > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: (income ?? []).length > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: (expenses ?? []).length > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: (projections ?? []).length > 0 },
    { key: 'scenarios', label: 'Compare scenarios', href: '/scenarios', done: false },
  ]

  const completedSteps = setupSteps.filter((s) => s.done).length
  const progressPct = Math.round((completedSteps / setupSteps.length) * 100)

  const isConsumerTier2 = profile?.role === 'consumer' && (profile?.consumer_tier ?? 1) === 2
  const completionScore: CompletionScore | null = isConsumerTier2 ? await getCompletionScore(user!.id) : null

  // Compute estate health score for all users with a household (Sprint 56)
  const estateHealthScore: EstateHealthScore | null = household?.id ? await computeEstateHealthScore(household.id, user!.id) : null
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

  // Current law exemption from DB
  const { data: taxConfig } = await supabase
    .from('federal_tax_config')
    .select('estate_exemption_individual, estate_top_rate_pct')
    .eq('scenario_id', 'current_law_extended')
    .single()

  const exemption = taxConfig?.estate_exemption_individual ?? 13_610_000
  const topRate = (taxConfig?.estate_top_rate_pct ?? 40) / 100
  const sunsetExemption = 7_000_000

  const alertYear = finalRow?.year ?? currentYear
  const { stateTax: sunsetAlertStateTax } = household
    ? calculateStateEstateTax({
        grossEstate: grossAtDeath,
        stateCode: parseStateTaxCode(household.state_primary),
        year: alertYear,
        federalExemption: exemption,
      })
    : { stateTax: 0 }

  const sunsetAlertHouseholdName =
    [household?.person1_first_name, household?.person1_last_name].filter(Boolean).join(' ').trim() ||
    (typeof household?.person1_name === 'string' ? household.person1_name.trim() : '') ||
    undefined
  const costOfWaiting = Math.max(
    0,
    Math.round(Math.max(0, grossAtDeath - sunsetExemption) * topRate) -
      Math.round(Math.max(0, grossAtDeath - exemption) * topRate),
  )
  // Run conflict detector for all users with a household (Sprint 58)
  const conflictReport = household?.id ? await detectConflicts(household.id, user!.id) : null

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
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      savingsRate={savingsRate}
      setupSteps={setupSteps}
      completedSteps={completedSteps}
      progressPct={progressPct}
      userId={user!.id}
      householdId={household?.id ?? null}
      hasBaseCase={!!household?.base_case_scenario_id}
      scenarioId={household?.base_case_scenario_id ?? null}
      completionScore={completionScore}
      consumerTier={profile?.consumer_tier ?? 1}
      allocationContext={allocationContext}
      estateHealthScore={estateHealthScore}
      costOfWaiting={costOfWaiting}
      conflictReport={conflictReport}
      isAdvisor={profile?.role === 'advisor'}
      sunsetAlert={{
        currentFederalTax: finalRow?.estate_tax_federal ?? 0,
        sunsetFederalTax,
        stateTax: sunsetAlertStateTax,
        stateCode: household?.state_primary ?? undefined,
        householdName: sunsetAlertHouseholdName,
      }}
    />
  )
}

import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { detectConflicts } from '@/lib/conflict-detector'
import { computeEstateHealthScore, type EstateHealthScore } from '@/lib/estate-health-score'
import { getCompletionScore, type CompletionScore } from '@/lib/get-completion-score'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '../_dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: household } = await supabase.from('households').select('*').eq('owner_id', user!.id).single()

  const [{ data: profile }, { data: assets }, { data: liabilities }, { data: income }, { data: expenses }, { data: projections }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase.from('assets').select('value').eq('owner_id', user!.id),
      supabase.from('liabilities').select('balance').eq('owner_id', user!.id),
      supabase.from('income').select('amount, start_year, end_year').eq('owner_id', user!.id).neq('source', 'social_security'),
      supabase.from('expenses').select('amount').eq('owner_id', user!.id),
      household?.id ? supabase.from('projections').select('summary').eq('household_id', household.id).limit(1) : Promise.resolve({ data: [] }),
    ])

  const totalAssets = (assets ?? []).reduce((sum, a) => sum + Number(a.value), 0)
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
      completionScore={completionScore}
      consumerTier={profile?.consumer_tier ?? 1}
      allocationContext={allocationContext}
      estateHealthScore={estateHealthScore}
      conflictReport={conflictReport}
      isAdvisor={profile?.role === 'advisor'}
    />
  )
}

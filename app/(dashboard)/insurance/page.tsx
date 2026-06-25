// ─────────────────────────────────────────
// Menu: Financial Planning > Life & Estate Insurance
// Route: /insurance
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'
import { fetchInsuranceTypes } from '@/lib/ref-data-fetchers'
import { analyzeGaps, buildInsuranceGapProfile, type InsurancePolicy } from '@/lib/insurance'
import { ComputedAnalysisSection } from '@/components/billing/ComputedAnalysisSection'
import InsuranceFormClient from './_insurance-form-client'
import { InsuranceGapPanel } from './_insurance-gap-panel'

const PC_TYPE_VALUES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

function sumAnnualIncome(rows: { annual_amount?: number | null; amount?: number | null; frequency?: string | null }[]) {
  return rows.reduce((sum, row) => {
    const amount = Number(row.annual_amount ?? row.amount ?? 0)
    if (row.annual_amount != null) return sum + amount
    const freq = row.frequency ?? 'annual'
    if (freq === 'monthly') return sum + amount * 12
    if (freq === 'weekly') return sum + amount * 52
    return sum + amount
  }, 0)
}

function sumMonthlyExpenses(rows: { amount?: number | null; frequency?: string | null }[]) {
  return rows.reduce((sum, row) => {
    const amount = Number(row.amount ?? 0)
    const freq = row.frequency ?? 'monthly'
    if (freq === 'annual') return sum + amount / 12
    if (freq === 'weekly') return sum + (amount * 52) / 12
    return sum + amount
  }, 0)
}

export default async function InsurancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getUserAccess()
  const showGapAnalysis = hasFeatureAccess(
    'insurance-gap-analysis',
    access.tier,
    access.isAdvisor,
    access.isTrial,
  )

  const [
    { data: policies },
    { data: allPolicies },
    insuranceTypes,
    { data: household },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('user_id', user.id)
      .not('insurance_type', 'in', `(${PC_TYPE_VALUES.join(',')})`)
      .order('created_at', { ascending: false }),
    supabase.from('insurance_policies').select('*').eq('user_id', user.id),
    fetchInsuranceTypes(),
    supabase
      .from('households')
      .select('person1_name, person2_name, has_spouse, person1_birth_year, person2_birth_year, dependents')
      .eq('owner_id', user.id)
      .maybeSingle(),
    supabase.from('assets').select('current_value').eq('owner_id', user.id),
    supabase.from('liabilities').select('current_balance').eq('owner_id', user.id),
    supabase.from('income').select('annual_amount, amount, frequency').eq('owner_id', user.id),
    supabase.from('expenses').select('amount, frequency').eq('owner_id', user.id),
  ])

  const gapProfile = buildInsuranceGapProfile(household ?? {}, {
    annualIncome: sumAnnualIncome(income ?? []),
    totalAssets: (assets ?? []).reduce((s, a) => s + Number(a.current_value ?? 0), 0),
    totalDebts: (liabilities ?? []).reduce((s, l) => s + Number(l.current_balance ?? 0), 0),
    monthlyExpenses: sumMonthlyExpenses(expenses ?? []),
  })

  const gaps = analyzeGaps(gapProfile, (allPolicies ?? []) as InsurancePolicy[])

  return (
    <div>
      <InsuranceFormClient
        policies={policies ?? []}
        insuranceTypes={insuranceTypes}
        person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
        person2Name={household?.person2_name != null ? displayPersonFirstName(household.person2_name, 'Person 2') : null}
        hasSpouse={household?.has_spouse ?? false}
      />
      <div className="mx-auto max-w-4xl px-4 pb-12">
        <ComputedAnalysisSection
          canAccess={showGapAnalysis}
          feature="insurance-gap-analysis"
          moduleName="Coverage gap analysis"
          valueProposition="See recommended life, disability, LTC, and P&C coverage vs your current policies."
        >
          <InsuranceGapPanel gaps={gaps} />
        </ComputedAnalysisSection>
      </div>
    </div>
  )
}

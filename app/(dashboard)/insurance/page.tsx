import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchInsuranceTypes } from '@/lib/ref-data-fetchers'
import { Suspense } from 'react'
import InsuranceFormClient from './_insurance-form-client'

export default async function InsurancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: policies }, insuranceTypes] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('id, insurance_type, policy_subtype, provider, policy_name, policy_number, coverage_amount, death_benefit, cash_value, monthly_premium, annual_premium, term_years, expiration_date, is_employer_provided, is_ilit, notes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    fetchInsuranceTypes(),
  ])

  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading...</div>}>
      <InsuranceFormClient
        policies={policies ?? []}
        insuranceTypes={insuranceTypes}
      />
    </Suspense>
  )
}

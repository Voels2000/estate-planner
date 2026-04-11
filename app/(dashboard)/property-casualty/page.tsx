// ─────────────────────────────────────────
// Menu: Financial Planning > Property & Casualty
// Route: /property-casualty
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchPCInsuranceTypes } from '@/lib/ref-data-fetchers'
import PCInsuranceFormClient from './_pc-insurance-form-client'

// P&C insurance type values from ref_pc_insurance_types
const PC_TYPE_VALUES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

export default async function PropertyCasualtyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: policies }, pcInsuranceTypes] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('id, insurance_type, provider, policy_name, policy_number, coverage_amount, deductible, monthly_premium, annual_premium, expiration_date, notes')
      .eq('user_id', user.id)
      .in('insurance_type', PC_TYPE_VALUES)
      .order('created_at', { ascending: false }),
    fetchPCInsuranceTypes(),
  ])

  return (
    <PCInsuranceFormClient
      policies={(policies ?? []) as Array<{
        id: string
        insurance_type: string | null
        provider: string | null
        policy_name: string | null
        policy_number: string | null
        coverage_amount: number | null
        deductible: number | null
        monthly_premium: number | null
        annual_premium: number | null
        expiration_date: string | null
        notes: string | null
      }>}
      pcInsuranceTypes={pcInsuranceTypes}
    />
  )
}

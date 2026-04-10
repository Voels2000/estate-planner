import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchInsuranceTypes } from '@/lib/ref-data-fetchers'
import InsuranceFormClient from './_insurance-form-client'

const PC_TYPE_VALUES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

export default async function InsurancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: policies }, insuranceTypes] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('user_id', user.id)
      .not('insurance_type', 'in', `(${PC_TYPE_VALUES.join(',')})`)
      .order('created_at', { ascending: false }),
    fetchInsuranceTypes(),
  ])

  return (
    <InsuranceFormClient
      policies={policies ?? []}
      insuranceTypes={insuranceTypes}
    />
  )
}

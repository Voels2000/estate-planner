import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchInsuranceTypes } from '@/lib/ref-data-fetchers'
import InsuranceFormClient from './_insurance-form-client'

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

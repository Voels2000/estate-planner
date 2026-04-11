// ─────────────────────────────────────────
// Menu: Financial Planning > Life & Estate Insurance
// Route: /insurance
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { fetchInsuranceTypes } from '@/lib/ref-data-fetchers'
import InsuranceFormClient from './_insurance-form-client'

const PC_TYPE_VALUES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

export default async function InsurancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: policies }, insuranceTypes, { data: household }] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('user_id', user.id)
      .not('insurance_type', 'in', `(${PC_TYPE_VALUES.join(',')})`)
      .order('created_at', { ascending: false }),
    fetchInsuranceTypes(),
    supabase
      .from('households')
      .select('person1_name, person2_name, has_spouse')
      .eq('owner_id', user.id)
      .maybeSingle(),
  ])

  return (
    <InsuranceFormClient
      policies={policies ?? []}
      insuranceTypes={insuranceTypes}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={household?.person2_name != null ? displayPersonFirstName(household.person2_name, 'Person 2') : null}
      hasSpouse={household?.has_spouse ?? false}
    />
  )
}

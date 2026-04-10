import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  fetchBusinessEntityTypes,
  fetchValuationMethods,
  fetchSuccessionPlans,
} from '@/lib/ref-data-fetchers'
import BusinessFormClient from './_business-form-client'

export default async function BusinessesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const [{ data: businesses }, entityTypes, valuationMethods, successionPlans] = await Promise.all([
    supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    fetchBusinessEntityTypes(),
    fetchValuationMethods(),
    fetchSuccessionPlans(),
  ])

  return (
    <BusinessFormClient
      businesses={businesses ?? []}
      entityTypes={entityTypes}
      valuationMethods={valuationMethods}
      successionPlans={successionPlans}
      householdId={household?.id ?? ''}
    />
  )
}

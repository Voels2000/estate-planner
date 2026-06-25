// ─────────────────────────────────────────
// Menu: Financial Planning > Real Estate
// Route: /real-estate
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'
import { fetchPropertyTypes, fetchTitlingTypes } from '@/lib/ref-data-fetchers'
import RealEstateClient from './_real-estate-client'

export default async function RealEstatePage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showComputedAnalysis = hasFeatureAccess(
    'real-estate-analysis',
    access.tier,
    access.isAdvisor,
    access.isTrial,
  )

  const [{ data: properties }, { data: household }, titlingTypes, propertyTypes] = await Promise.all([
    supabase.from('real_estate').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('households').select('person1_name, person2_name, filing_status').eq('owner_id', user.id).single(),
    fetchTitlingTypes(),
    fetchPropertyTypes(),
  ])

  return (
    <RealEstateClient
      initialProperties={properties ?? []}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={displayPersonFirstName(household?.person2_name, 'Person 2')}
      filingStatus={household?.filing_status ?? 'single'}
      titlingTypes={titlingTypes}
      propertyTypes={propertyTypes}
      showComputedAnalysis={showComputedAnalysis}
    />
  )
}

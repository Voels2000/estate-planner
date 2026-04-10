import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { fetchPropertyTypes, fetchTitlingTypes } from '@/lib/ref-data-fetchers'
import RealEstateClient from './_real-estate-client'

export default async function RealEstatePage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Real Estate</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Real Estate"
          valueProposition="Analyze equity, titling risk, and out-of-state property exposure."
        />
      </div>
    )
  }

  const [{ data: properties }, { data: household }, titlingTypes, propertyTypes] = await Promise.all([
    supabase.from('real_estate').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('households').select('person1_name, person2_name, filing_status').eq('owner_id', user.id).single(),
    fetchTitlingTypes(),
    fetchPropertyTypes(),
  ])

  return (
    <RealEstateClient
      initialProperties={properties ?? []}
      person1Name={household?.person1_name ?? 'Person 1'}
      person2Name={household?.person2_name ?? 'Person 2'}
      filingStatus={household?.filing_status ?? 'single'}
      titlingTypes={titlingTypes}
      propertyTypes={propertyTypes}
    />
  )
}

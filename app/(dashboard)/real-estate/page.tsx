import { getUserAccess } from '@/lib/get-user-access'
import { GatedPage } from '@/components/gated-page'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RealEstateClient from './_real-estate-client'

export default async function RealEstatePage() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return (
      <GatedPage requiredTier={2} currentTier={access.tier} featureName="Real Estate">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">Real Estate</h1>
        </div>
      </GatedPage>
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: properties }, { data: household }] = await Promise.all([
    supabase.from('real_estate').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('households').select('person1_name, person2_name, filing_status').eq('owner_id', user.id).single(),
  ])

  return (
    <RealEstateClient
      initialProperties={properties ?? []}
      person1Name={household?.person1_name ?? 'Person 1'}
      person2Name={household?.person2_name ?? 'Person 2'}
      filingStatus={household?.filing_status ?? 'single'}
    />
  )
}

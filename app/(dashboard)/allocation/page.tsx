import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { GatedPage } from '@/components/gated-page'
import AllocationClient from './_allocation-client'

export const metadata = {
  title: 'Asset Allocation | Estate Planner',
  description: 'Define your target mix of stocks, bonds, and cash',
}

export default async function AssetAllocationPage() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return (
      <GatedPage requiredTier={2} currentTier={access.tier} featureName="Asset Allocation">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">Asset Allocation</h1>
        </div>
      </GatedPage>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <AllocationClient userTier={access.tier} />
}

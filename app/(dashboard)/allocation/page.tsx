import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import AllocationClient from './_allocation-client'

export const metadata = {
  title: 'Asset Allocation | Estate Planner',
  description: 'Define your target mix of stocks, bonds, and cash',
}

export default async function AssetAllocationPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Asset Allocation</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Asset Allocation"
          valueProposition="See your full portfolio breakdown, target allocation, and rebalancing recommendations."
        />
      </div>
    )
  }

  return <AllocationClient userTier={access.tier} />
}

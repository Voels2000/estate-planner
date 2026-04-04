import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import AllocationClient from './_allocation-client'

export const metadata = {
  title: 'Asset Allocation | Estate Planner',
  description: 'Define your target mix of stocks, bonds, and cash',
}

export default async function AssetAllocationPage() {
  const access = await getUserAccess()
  // Former tier billing redirect removed — layout enforces subscription.

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <AllocationClient userTier={access.tier} />
}

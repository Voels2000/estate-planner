import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import AllocationClient from './_allocation-client'

export default async function AssetAllocationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getUserAccess()
  if (access.tier < 2) redirect('/dashboard')

  return <AllocationClient />
}
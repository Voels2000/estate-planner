import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import MyEstateTrustStrategyClient from './_client'

export default async function MyEstateTrustStrategyPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">My Estate & Trust Strategy</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="My Estate & Trust Strategy"
          valueProposition="Track gifting, charitable giving, and estate transfer strategies in one place."
        />
      </div>
    )
  }

  const { data: householdRow } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!householdRow?.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <MyEstateTrustStrategyClient
        householdId={householdRow.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
        initialTab={searchParams.tab ?? 'gifting'}
      />
    </div>
  )
}

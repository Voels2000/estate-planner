// ─────────────────────────────────────────
// Menu: Retirement Planning > Lifetime Snapshot
// Route: /complete
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import CompleteClient from './_complete-client'

export default async function CompletePage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Complete Estate Plan</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Complete Estate Plan"
          valueProposition="Get a full summary and action plan across every dimension of your estate."
        />
      </div>
    )
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/projection`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  })

  if (!res.ok) {
    return (
      <div className="p-8 text-center text-gray-500">
        No household data found. Please complete your profile first.
      </div>
    )
  }

  const data = await res.json()
  const { rows, household } = data

  if (!household) {
    return (
      <div className="p-8 text-center text-gray-500">
        No household data found. Please complete your profile first.
      </div>
    )
  }


  return (
    <CompleteClient
      rows={rows}
      person1Name={displayPersonFirstName(household.person1_name, 'Person 1')}
      person2Name={
        household.has_spouse ? displayPersonFirstName(household.person2_name, 'Person 2') : null
      }
      hasSpouse={household.has_spouse ?? false}
    />
  )
}

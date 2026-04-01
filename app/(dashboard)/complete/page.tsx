import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import CompleteClient from './_complete-client'

export default async function CompletePage() {
  const access = await getUserAccess()
  if (access.tier < 3) {
    redirect('/billing?returnTo=/complete')
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
      person1Name={household.person1_name ?? 'Person 1'}
      person2Name={household.has_spouse ? (household.person2_name ?? 'Person 2') : null}
      hasSpouse={household.has_spouse ?? false}
    />
  )
}

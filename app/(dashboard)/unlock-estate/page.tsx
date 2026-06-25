import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'
import { getCompletionScore } from '@/lib/get-completion-score'
import { UnlockEstateClient } from './_unlock-estate-client'

export default async function UnlockEstatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getUserAccess()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (isAdvisorIdentity(profile?.role)) redirect('/dashboard')

  if (access.tier >= 3) redirect('/titling')

  const score = await getCompletionScore(user.id)

  return <UnlockEstateClient score={score} />
}

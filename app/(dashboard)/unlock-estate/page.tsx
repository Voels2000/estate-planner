import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCompletionScore } from '@/lib/get-completion-score'
import { UnlockEstateClient } from './_unlock-estate-client'

export default async function UnlockEstatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Advisors don't need this page
  if (profile.role === 'advisor') redirect('/dashboard')

  // Already unlocked — send them straight to estate planning
  if ((profile.consumer_tier ?? 1) >= 3) redirect('/titling')

  const score = await getCompletionScore(user.id)

  return <UnlockEstateClient score={score} />
}

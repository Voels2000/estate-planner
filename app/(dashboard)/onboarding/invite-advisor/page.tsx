import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isMinimumViableProfile } from '@/lib/estate/profileGate'
import { InviteAdvisorOnboardingClient } from './_invite-advisor-client'

export default async function InviteAdvisorOnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, role, onboarding_invite_advisor_completed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('households').select('*').eq('owner_id', user.id).maybeSingle(),
  ])

  if (profile?.onboarding_invite_advisor_completed_at) {
    redirect('/dashboard')
  }

  const gate = isMinimumViableProfile(household ?? {})
  if (!gate.complete) {
    redirect('/profile?required=true')
  }

  if (profile?.role && profile.role !== 'consumer') {
    redirect('/dashboard')
  }

  const consumerName = profile?.full_name ?? 'Your client'

  return <InviteAdvisorOnboardingClient consumerName={consumerName} />
}

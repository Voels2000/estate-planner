import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
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
    supabase
      .from('households')
      .select('state_primary, filing_status, person1_birth_year')
      .eq('owner_id', user.id)
      .maybeSingle(),
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
  const appUrl = getAppUrl()
  const inviteEmailBody = encodeURIComponent(
    `Hi,\n\nI've been using My Wealth Maps to organize my estate and financial plan, and I'd like to invite you to connect so you can view my plan and collaborate with me.\n\nClick here to join: ${appUrl}/signup?role=advisor\n\nOnce you're set up, search for me by email to connect.\n\nThanks,\n${consumerName}`,
  )
  const inviteEmailSubject = encodeURIComponent('Invitation to connect on My Wealth Maps')

  return (
    <InviteAdvisorOnboardingClient
      inviteEmailSubject={inviteEmailSubject}
      inviteEmailBody={inviteEmailBody}
      consumerName={consumerName}
    />
  )
}

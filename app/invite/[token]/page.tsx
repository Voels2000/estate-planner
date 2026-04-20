import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import InviteClient from './_invite-client'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Validate invite — read only, no mutations
  const { data: invite } = await admin
    .from('advisor_clients')
    .select('id, advisor_id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) redirect('/invite/invalid')
  if (new Date(invite.invite_expires_at) < new Date()) redirect('/invite/expired')

  // 2. Fetch advisor name for display
  const { data: advisorProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', invite.advisor_id)
    .single()

  const advisorName = advisorProfile?.full_name?.trim() || advisorProfile?.email || 'Your advisor'

  // 3. If not logged in OR logged-in user is not the invited person
  // redirect to signup — do NOT sign them out
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== invite.invited_email?.toLowerCase()) {
    // Check if this email already has an auth account (profiles row exists for every auth user)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', invite.invited_email ?? '')
      .maybeSingle()
    const alreadyRegistered = !!existingProfile
    if (alreadyRegistered) {
      // Existing user — send to login with invite token preserved as redirectTo
      redirect(`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invite.invited_email ?? '')}`)
    } else {
      // New user — send to signup as before
      redirect(`/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email ?? '')}`)
    }
  }

  // 4. Consent gate — correct person is logged in; no mutations until user clicks Accept
  return (
    <InviteClient
      token={token}
      advisorName={advisorName}
      invitedEmail={invite.invited_email ?? ''}
    />
  )
}

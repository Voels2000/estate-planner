import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyInviteAcceptClient } from './_attorney-invite-accept-client'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AttorneyInvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('attorney_clients')
    .select('id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) redirect('/invite/invalid')
  if (new Date(invite.invite_expires_at) < new Date()) redirect('/invite/expired')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <AttorneyInviteAcceptClient
      token={token}
      isLoggedIn={!!user}
      invitedEmail={invite.invited_email}
    />
  )
}

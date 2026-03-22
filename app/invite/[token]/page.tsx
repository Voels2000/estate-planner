import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: { token: string }
}

export default async function InvitePage({ params }: Props) {
  const { token } = params
  const supabase = await createClient()

  // Look up the invite
  const { data: invite } = await supabase
    .from('advisor_clients')
    .select('id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  // Invalid or already used token
  if (!invite) {
    redirect('/invite/invalid')
  }

  // Expired token
  if (new Date(invite.invite_expires_at) < new Date()) {
    redirect('/invite/expired')
  }

  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Already has an account — attempt to link them directly
    try {
      await supabase
        .from('advisor_clients')       .update({
          client_id: user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite.id)
    } catch (err) {
      console.error('Could not link existing user to invite:', err)
    }
    console.log('DEBUG invite update attempted for invite id:', invite.id, 'user id:', user.id)
    redirect('/dashboard')
  }

  // Not logged in — send to signup with token preserved in URL
  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email)}`)
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('advisor_clients')
    .select('id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) {
    redirect('/invite/invalid')
  }

  if (new Date(invite.invite_expires_at) < new Date()) {
    redirect('/invite/expired')
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    redirect('/dashboard')
  }

  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email)}`)
}

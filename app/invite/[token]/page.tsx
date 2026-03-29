import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('advisor_clients')
    .select('id, advisor_id, invited_email, status, invite_expires_at')
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
    const { error: acceptError } = await supabase
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (!acceptError) {
      const advisorId = invite.advisor_id
      const clientId = user.id
      after(() => {
        const admin = createAdminClient()
        ;(async () => {
          try {
            await admin.rpc('create_notification', {
              p_user_id: advisorId,
              p_type: 'client_accepted_invite',
              p_title: 'A client accepted your invitation',
              p_body:
                'A new client has accepted your invitation and is now linked to your account.',
              p_delivery: 'both',
              p_metadata: { client_id: clientId },
              p_cooldown: '1 hour',
            })
          } catch {}
        })()
      })
    }

    redirect('/dashboard')
  }

  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email)}`)
}

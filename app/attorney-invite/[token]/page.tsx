import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AttorneyInvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('attorney_clients')
    .select('id, attorney_id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) redirect('/invite/invalid')
  if (new Date(invite.invite_expires_at) < new Date()) redirect('/invite/expired')

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { error: acceptError } = await supabase
      .from('attorney_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        billing_transferred: false,
      })
      .eq('id', invite.id)

    if (!acceptError) {
      const attorneyId = invite.attorney_id
      const clientId = user.id

      after(() => {
        const admin = createAdminClient()

        ;(async () => {
          try {
            // 1. Notify attorney
            await admin.rpc('create_notification', {
              p_user_id: attorneyId,
              p_type: 'client_accepted_invite',
              p_title: 'A client accepted your invitation',
              p_body: 'A new client has accepted your invitation and is now linked to your account.',
              p_delivery: 'both',
              p_metadata: { client_id: clientId },
              p_cooldown: '1 hour',
            })

            // 2. Notify consumer
            await admin.rpc('create_notification', {
              p_user_id: clientId,
              p_type: 'estate_milestone',
              p_title: '✅ Connected to your attorney',
              p_body: 'You are now connected with your attorney on MyWealthMaps. They can collaborate with you on your estate plan.',
              p_delivery: 'both',
              p_metadata: { attorney_id: attorneyId },
              p_cooldown: '1 hour',
            })
          } catch (err) {
            console.error('attorney-invite after(): error', err)
          }
        })()
      })
    }

    redirect('/dashboard')
  }

  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email ?? '')}&type=attorney`)
}

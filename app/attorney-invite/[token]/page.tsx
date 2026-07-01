import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAttorneyConnectionBilling } from '@/lib/attorney/applyAttorneyConnectionBilling'
import { createClient } from '@/lib/supabase/server'
import { resolveAttorneyProfileId } from '@/lib/attorney/resolveAttorneyProfileId'
import { resolveConsumerHouseholdId } from '@/lib/attorney/verifyAttorneyHouseholdAccess'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  afterAttorneyConnectionBillingConnect,
  assessAttorneyConnectionBillingGate,
} from '@/lib/billing/attorneyConnectionBilling'

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
    const admin = createAdminClient()
    const householdId = await resolveConsumerHouseholdId(admin, user.id)

    if (!householdId) {
      redirect('/dashboard?attorney_invite=missing_household')
    }

    if (isConnectionBillingEnabled()) {
      const gate = await assessAttorneyConnectionBillingGate(
        admin,
        invite.attorney_id,
        householdId,
      )
      if (!gate.ok) {
        redirect('/dashboard?attorney_invite=capacity_blocked')
      }
    }

    const { error: acceptError } = await admin
      .from('attorney_clients')
      .update({
        client_id: householdId,
        status: 'accepted',
        billing_transferred: false,
      })
      .eq('id', invite.id)

    if (!acceptError) {
      const attorneyProfileId = await resolveAttorneyProfileId(admin, invite.attorney_id)
      const clientId = user.id

      await applyAttorneyConnectionBilling(admin, {
        clientId,
        attorneyClientRowId: invite.id,
      })

      if (isConnectionBillingEnabled()) {
        await afterAttorneyConnectionBillingConnect(admin, invite.attorney_id)
      }

      after(() => {
        const admin = createAdminClient()

        ;(async () => {
          try {
            if (attorneyProfileId) {
              await admin.rpc('create_notification', {
                p_user_id: attorneyProfileId,
                p_type: 'client_accepted_invite',
                p_title: 'A client accepted your invitation',
                p_body: 'A new client has accepted your invitation and is now linked to your account.',
                p_delivery: 'both',
                p_metadata: { client_id: clientId, household_id: householdId },
                p_cooldown: '1 hour',
              })
            }

            await admin.rpc('create_notification', {
              p_user_id: clientId,
              p_type: 'estate_milestone',
              p_title: '✅ Connected to your attorney',
              p_body: 'You are now connected with your attorney on My Wealth Maps. They can collaborate with you on your estate plan.',
              p_delivery: 'both',
              p_metadata: { attorney_listing_id: invite.attorney_id },
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

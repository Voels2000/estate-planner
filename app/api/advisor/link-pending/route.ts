import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { applyAdvisorConnectionBilling } from '@/lib/advisor/applyAdvisorConnectionBilling'
import { notifyAdvisorFirstClientConnected } from '@/lib/advisor/notifyFirstClientConnected'
import {
  assessFirmConnectionBillingGate,
  getAdvisorFirmBillingContext,
  syncFirmConnectionBillingQuantity,
} from '@/lib/billing/firmConnectionBilling'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: invite } = await supabase
      .from('advisor_clients')
      .select('id, advisor_id, invite_expires_at')
      .eq('invited_email', user.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ linked: false })
    }

    if (new Date(invite.invite_expires_at) < new Date()) {
      return NextResponse.json({ linked: false, reason: 'expired' })
    }

    const admin = createAdminClient()

    const gate = await assessFirmConnectionBillingGate(admin, invite.advisor_id, user.id)
    if (!gate.ok) return gate.response

    const { error: linkError } = await admin
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)

    if (linkError) {
      console.error('Link error:', linkError)
      return NextResponse.json({ error: 'Failed to link invite' }, { status: 500 })
    }

    const advisorId = invite.advisor_id
    const clientId = user.id

    after(() => {
      const adminAfter = createAdminClient()
      ;(async () => {
        try {
          await applyAdvisorConnectionBilling(adminAfter, {
            clientId,
            advisorClientRowId: invite.id,
          })

          await adminAfter.rpc('create_notification', {
            p_user_id: advisorId,
            p_type: 'client_accepted_invite',
            p_title: 'A client accepted your invitation',
            p_body:
              'A new client has accepted your invitation and is now linked to your account.',
            p_delivery: 'both',
            p_metadata: { client_id: clientId },
            p_cooldown: '1 hour',
          })

          const { data: clientProfile } = await adminAfter
            .from('profiles')
            .select('full_name')
            .eq('id', clientId)
            .maybeSingle()

          await notifyAdvisorFirstClientConnected(adminAfter, {
            advisorId,
            clientId,
            clientName: clientProfile?.full_name ?? null,
          })

          const { firmId } = await getAdvisorFirmBillingContext(adminAfter, advisorId)
          await syncFirmConnectionBillingQuantity(firmId)
        } catch (err) {
          console.error('link-pending after():', err)
        }
      })()
    })

    return NextResponse.json({ linked: true })
  } catch (err) {
    console.error('Link-pending error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find any pending invite for this email
    const { data: invite } = await supabase
      .from('advisor_clients')
      .select('id, advisor_id, invite_expires_at')
      .eq('invited_email', user.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ linked: false })
    }

    // Check not expired
    if (new Date(invite.invite_expires_at) < new Date()) {
      return NextResponse.json({ linked: false, reason: 'expired' })
    }

    // Link the new user to their advisor
    const { error } = await supabase
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (error) {
      console.error('Link error:', error)
      return NextResponse.json({ error: 'Failed to link invite' }, { status: 500 })
    }

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

    return NextResponse.json({ linked: true })

  } catch (err) {
    console.error('Link-pending error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

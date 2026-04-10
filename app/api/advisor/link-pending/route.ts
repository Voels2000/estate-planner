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

    const admin = createAdminClient()

    const { data: consumerProfile, error: profileFetchError } = await admin
      .from('profiles')
      .select('consumer_tier, subscription_period_end, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileFetchError) {
      console.error('Link-pending profile fetch:', profileFetchError)
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    const previousTier = consumerProfile?.consumer_tier ?? 1
    const cancelAt = consumerProfile?.subscription_period_end ?? null

    const { error: linkError } = await admin
      .from('advisor_clients')
      .update({
        client_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        billing_transferred: true,
        billing_transferred_at: new Date().toISOString(),
        previous_consumer_tier: previousTier,
        consumer_subscription_cancel_at: cancelAt,
      })
      .eq('id', invite.id)

    if (linkError) {
      console.error('Link error:', linkError)
      return NextResponse.json({ error: 'Failed to link invite' }, { status: 500 })
    }

    const isConsumerInvitee =
      consumerProfile?.role === 'consumer' || consumerProfile?.role == null

    if (isConsumerInvitee) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          subscription_status: 'advisor_managed',
          subscription_plan: 'advisor_managed',
        })
        .eq('id', user.id)

      if (profileUpdateError) {
        console.error('Link-pending profile update:', profileUpdateError)
        return NextResponse.json(
          { error: 'Failed to update subscription state' },
          { status: 500 },
        )
      }
    }

    const advisorId = invite.advisor_id
    const clientId = user.id
    after(() => {
      const adminAfter = createAdminClient()
      ;(async () => {
        try {
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
        } catch {}
      })()
    })

    return NextResponse.json({ linked: true })

  } catch (err) {
    console.error('Link-pending error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

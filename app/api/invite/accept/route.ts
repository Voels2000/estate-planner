import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAdvisorConnectionBilling } from '@/lib/advisor/applyAdvisorConnectionBilling'
import { notifyAdvisorFirstClientConnected } from '@/lib/advisor/notifyFirstClientConnected'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const { data: invite } = await admin
    .from('advisor_clients')
    .select('id, advisor_id, invited_email, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
  }

  if (new Date(invite.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  const userEmail = user.email?.trim().toLowerCase()
  const invitedEmail = invite.invited_email?.trim().toLowerCase()
  if (userEmail && invitedEmail && userEmail !== invitedEmail) {
    return NextResponse.json(
      { error: 'This invite was sent to a different email address. Sign in with the invited email to accept.' },
      { status: 403 },
    )
  }

  const { error: acceptError } = await admin
    .from('advisor_clients')
    .update({
      client_id: user.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (acceptError) {
    console.error('invite accept error:', acceptError)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
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
          p_body: 'A new client has accepted your invitation and is now linked to your account.',
          p_delivery: 'both',
          p_metadata: { client_id: clientId },
          p_cooldown: '1 hour',
        })

        const billing = await applyAdvisorConnectionBilling(adminAfter, {
          clientId,
          advisorClientRowId: invite.id,
        })

        if (billing.ok && billing.billingTransferred) {
          await adminAfter.rpc('create_notification', {
            p_user_id: clientId,
            p_type: 'estate_milestone',
            p_title: '🎉 Estate Planning unlocked!',
            p_body:
              'Your advisor has added you to their practice. Estate Planning features are now available and your subscription will be covered going forward.',
            p_delivery: 'both',
            p_metadata: {
              advisor_id: advisorId,
              unlocked_tier: 3,
              cancel_at: billing.cancelAt,
            },
            p_cooldown: '1 hour',
          })
        } else if (billing.ok) {
          await adminAfter.rpc('create_notification', {
            p_user_id: clientId,
            p_type: 'estate_milestone',
            p_title: '🎉 Connected to your advisor',
            p_body:
              'Your advisor has added you to their practice. You can collaborate on your estate plan in My Wealth Maps.',
            p_delivery: 'both',
            p_metadata: { advisor_id: advisorId },
            p_cooldown: '1 hour',
          })
        }

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
      } catch (err) {
        console.error('invite after(): error', err)
      }
    })()
  })

  return NextResponse.json({ success: true })
}

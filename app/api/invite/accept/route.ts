import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Auth check — must be logged in to accept
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse token
  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  // 3. Fetch invite — must be pending and not expired
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

  // 4. Commit accept — FIX: write 'active' not 'accepted'
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

  // 5. Background: billing transfer + notifications
  after(() => {
    const admin = createAdminClient()

    ;(async () => {
      try {
        // Notify advisor
        await admin.rpc('create_notification', {
          p_user_id: advisorId,
          p_type: 'client_accepted_invite',
          p_title: 'A client accepted your invitation',
          p_body: 'A new client has accepted your invitation and is now linked to your account.',
          p_delivery: 'both',
          p_metadata: { client_id: clientId },
          p_cooldown: '1 hour',
        })

        // Fetch consumer profile
        const { data: consumerProfile } = await admin
          .from('profiles')
          .select('consumer_tier, stripe_customer_id, role')
          .eq('id', clientId)
          .single()

        // Only transfer billing for consumers
        if (consumerProfile?.role === 'consumer') {
          const previousTier = consumerProfile.consumer_tier ?? 1

          // Step 1: always upgrade to Tier 3
          await admin.from('profiles').update({ consumer_tier: 3 }).eq('id', clientId)
          await admin
            .from('advisor_clients')
            .update({ previous_consumer_tier: previousTier })
            .eq('id', invite.id)

          // Step 2: attempt Stripe cancellation independently; failure should not block tier upgrade
          let cancelAt: string | null = null
          if (consumerProfile.stripe_customer_id) {
            try {
              const stripeRes = await fetch(
                `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(consumerProfile.stripe_customer_id)}&status=active&limit=1`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                  },
                }
              )
              const stripeData = await stripeRes.json() as {
                data: Array<{ id: string; current_period_end: number }>
              }

              const activeSub = stripeData.data?.[0]
              if (activeSub) {
                const cancelRes = await fetch(
                  `https://api.stripe.com/v1/subscriptions/${activeSub.id}`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'cancel_at_period_end=true',
                  }
                )
                if (!cancelRes.ok) {
                  throw new Error(`Stripe cancel failed: ${cancelRes.status}`)
                }
                cancelAt = new Date(activeSub.current_period_end * 1000).toISOString()
              }
            } catch (stripeErr) {
              console.error('invite: stripe cancel error — tier already upgraded', stripeErr)
              await admin
                .from('advisor_clients')
                .update({ billing_transferred: false })
                .eq('id', invite.id)
            }
          }

          // Step 3: mark billing transfer complete
          await admin
            .from('advisor_clients')
            .update({
              billing_transferred: true,
              billing_transferred_at: new Date().toISOString(),
              consumer_subscription_cancel_at: cancelAt,
            })
            .eq('id', invite.id)

          // Notify consumer
          await admin.rpc('create_notification', {
            p_user_id: clientId,
            p_type: 'estate_milestone',
            p_title: '🎉 Estate Planning unlocked!',
            p_body:
              'Your advisor has added you to their practice. Estate Planning features are now available and your subscription will be covered going forward.',
            p_delivery: 'both',
            p_metadata: { advisor_id: advisorId, unlocked_tier: 3, cancel_at: cancelAt },
            p_cooldown: '1 hour',
          })
        }
      } catch (err) {
        console.error('invite after(): error', err)
      }
    })()
  })

  return NextResponse.json({ success: true })
}

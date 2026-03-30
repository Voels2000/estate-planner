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

  if (!invite) redirect('/invite/invalid')
  if (new Date(invite.invite_expires_at) < new Date()) redirect('/invite/expired')

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
            // 1. Notify advisor
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

            // 2. Fetch consumer profile to check subscription
            const { data: consumerProfile } = await admin
              .from('profiles')
              .select('consumer_tier, stripe_customer_id, role')
              .eq('id', clientId)
              .single()

            // 3. Only transfer billing for consumers (not advisors)
            if (consumerProfile?.role === 'consumer') {
              // 4. Upgrade consumer to Tier 3 immediately, store previous tier
              const previousTier = consumerProfile.consumer_tier ?? 1
              await admin.from('profiles').update({ consumer_tier: 3 }).eq('id', clientId)

              await admin
                .from('advisor_clients')
                .update({ previous_consumer_tier: previousTier })
                .eq('id', invite.id)

              // 5. Cancel consumer Stripe subscription at period end
              let cancelAt: string | null = null
              if (consumerProfile.stripe_customer_id) {
                try {
                  const stripeRes = await fetch('https://api.stripe.com/v1/subscriptions', {
                    headers: {
                      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                    },
                  })
                  const stripeData = (await stripeRes.json()) as {
                    data: Array<{
                      id: string
                      status: string
                      current_period_end: number
                      customer: string
                    }>
                  }

                  const activeSub = stripeData.data.find(
                    (s) =>
                      s.customer === consumerProfile.stripe_customer_id &&
                      ['active', 'trialing'].includes(s.status)
                  )

                  if (activeSub) {
                    // Cancel at period end
                    await fetch(`https://api.stripe.com/v1/subscriptions/${activeSub.id}`, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: 'cancel_at_period_end=true',
                    })
                    cancelAt = new Date(activeSub.current_period_end * 1000).toISOString()
                  }
                } catch (stripeErr) {
                  console.error('invite: stripe cancel error', stripeErr)
                }
              }

              // 6. Mark billing transfer complete on advisor_clients row
              await admin
                .from('advisor_clients')
                .update({
                  billing_transferred: true,
                  billing_transferred_at: new Date().toISOString(),
                  consumer_subscription_cancel_at: cancelAt,
                })
                .eq('id', invite.id)

              // 7. Notify consumer — Tier 3 unlocked
              await admin.rpc('create_notification', {
                p_user_id: clientId,
                p_type: 'estate_milestone',
                p_title: '🎉 Estate Planning unlocked!',
                p_body:
                  'Your advisor has added you to their practice. Estate Planning features are now available and your subscription will be covered going forward.',
                p_delivery: 'both',
                p_metadata: {
                  advisor_id: advisorId,
                  unlocked_tier: 3,
                  cancel_at: cancelAt,
                },
                p_cooldown: '1 hour',
              })
            }
          } catch (err) {
            console.error('invite after(): error', err)
          }
        })()
      })
    }

    redirect('/dashboard')
  }

  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email ?? '')}`)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAdvisorDisconnectResubscribeEmail } from '@/lib/email/advisorDisconnectResubscribeEmail'
import { getAppUrl } from '@/lib/app-url'

export type RestoreConsumerBillingParams = {
  clientId: string
  advisorClientRowId: string
  advisorId?: string
  sendEmail?: boolean
}

export type RestoreConsumerBillingResult = {
  ok: boolean
  restoredTier: number
  stripeResumed: boolean
}

/**
 * Revert consumer billing when an advisor connection ends.
 * Restores previous tier, clears advisor_managed, and attempts to resume a paused Stripe sub.
 */
export async function restoreConsumerBillingOnDisconnect(
  admin: SupabaseClient,
  params: RestoreConsumerBillingParams,
): Promise<RestoreConsumerBillingResult> {
  const { clientId, advisorClientRowId, advisorId, sendEmail = true } = params

  const { data: linkRow } = await admin
    .from('advisor_clients')
    .select('billing_transferred, previous_consumer_tier')
    .eq('id', advisorClientRowId)
    .maybeSingle()

  const { data: consumerProfile } = await admin
    .from('profiles')
    .select('email, full_name, consumer_tier, subscription_status, stripe_customer_id, role')
    .eq('id', clientId)
    .maybeSingle()

  if (!consumerProfile || (consumerProfile.role && consumerProfile.role !== 'consumer')) {
    return { ok: false, restoredTier: consumerProfile?.consumer_tier ?? 1, stripeResumed: false }
  }

  const restoredTier =
    linkRow?.billing_transferred && linkRow.previous_consumer_tier != null
      ? linkRow.previous_consumer_tier
      : consumerProfile.subscription_status === 'advisor_managed'
        ? 1
        : (consumerProfile.consumer_tier ?? 1)

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      consumer_tier: restoredTier,
      subscription_status: 'none',
      subscription_plan: null,
    })
    .eq('id', clientId)

  if (profileError) {
    console.error('restoreConsumerBilling profile update:', profileError)
    return { ok: false, restoredTier, stripeResumed: false }
  }

  let stripeResumed = false
  if (consumerProfile.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(consumerProfile.stripe_customer_id)}&status=active&limit=1`,
        {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        },
      )
      const stripeData = (await stripeRes.json()) as {
        data: Array<{ id: string; cancel_at_period_end: boolean }>
      }
      const activeSub = stripeData.data?.[0]
      if (activeSub?.cancel_at_period_end) {
        const resumeRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${activeSub.id}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'cancel_at_period_end=false',
          },
        )
        stripeResumed = resumeRes.ok
      }
    } catch (err) {
      console.error('restoreConsumerBilling stripe resume:', err)
    }
  }

  await admin
    .from('advisor_clients')
    .update({
      billing_transferred: false,
      consumer_subscription_cancel_at: null,
    })
    .eq('id', advisorClientRowId)

  if (sendEmail && consumerProfile.email) {
    const appUrl = getAppUrl()
    const hadAdvisorManaged = consumerProfile.subscription_status === 'advisor_managed'
    const needsResubscribe = hadAdvisorManaged && restoredTier < 3 && !stripeResumed

    void sendAdvisorDisconnectResubscribeEmail({
      to: consumerProfile.email,
      firstName: consumerProfile.full_name?.split(' ')[0] ?? 'there',
      needsResubscribe,
      billingUrl: `${appUrl}/billing?plan=estate`,
      dashboardUrl: `${appUrl}/dashboard`,
    }).catch((err) => {
      console.error('disconnect resubscribe email:', err)
    })
  }

  try {
    await admin.rpc('create_notification', {
      p_user_id: clientId,
      p_type: 'estate_milestone',
      p_title: 'Advisor connection ended',
      p_body: stripeResumed
        ? 'Your advisor connection has ended. Your previous subscription will continue.'
        : restoredTier < 3
          ? 'Your advisor connection has ended. Subscribe to keep Estate planning access.'
          : 'Your advisor connection has ended. Your account access has been updated.',
      p_delivery: 'both',
      p_metadata: {
        advisor_id: advisorId ?? null,
        restored_tier: restoredTier,
        stripe_resumed: stripeResumed,
      },
      p_cooldown: '1 hour',
    })
  } catch {}

  return { ok: true, restoredTier, stripeResumed }
}

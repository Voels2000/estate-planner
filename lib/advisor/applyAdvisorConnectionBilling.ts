import type { SupabaseClient } from '@supabase/supabase-js'

export type ApplyAdvisorConnectionBillingParams = {
  clientId: string
  advisorClientRowId: string
  skipIfAlreadyTransferred?: boolean
}

export type ApplyAdvisorConnectionBillingResult = {
  ok: boolean
  previousTier: number
  cancelAt: string | null
  billingTransferred: boolean
}

/**
 * Upgrade a consumer to advisor-managed Tier 3 billing when an advisor connection activates.
 * Pauses active Stripe subscriptions at period end when possible.
 */
export async function applyAdvisorConnectionBilling(
  admin: SupabaseClient,
  params: ApplyAdvisorConnectionBillingParams,
): Promise<ApplyAdvisorConnectionBillingResult> {
  const { clientId, advisorClientRowId, skipIfAlreadyTransferred = false } = params

  const { data: linkRow } = await admin
    .from('advisor_clients')
    .select('billing_transferred')
    .eq('id', advisorClientRowId)
    .maybeSingle()

  if (skipIfAlreadyTransferred && linkRow?.billing_transferred) {
    return {
      ok: true,
      previousTier: 3,
      cancelAt: null,
      billingTransferred: true,
    }
  }

  const { data: consumerProfile } = await admin
    .from('profiles')
    .select('consumer_tier, stripe_customer_id, role, subscription_status')
    .eq('id', clientId)
    .single()

  if (!consumerProfile || (consumerProfile.role && consumerProfile.role !== 'consumer')) {
    return {
      ok: false,
      previousTier: consumerProfile?.consumer_tier ?? 1,
      cancelAt: null,
      billingTransferred: false,
    }
  }

  const previousTier = consumerProfile.consumer_tier ?? 1

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      consumer_tier: 3,
      subscription_status: 'advisor_managed',
      subscription_plan: 'advisor_managed',
    })
    .eq('id', clientId)

  if (profileError) {
    console.error('applyAdvisorConnectionBilling profile update:', profileError)
    return { ok: false, previousTier, cancelAt: null, billingTransferred: false }
  }

  let cancelAt: string | null = null
  let billingTransferred = true

  if (consumerProfile.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(consumerProfile.stripe_customer_id)}&status=active&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        },
      )
      const stripeData = (await stripeRes.json()) as {
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
          },
        )
        if (!cancelRes.ok) {
          throw new Error(`Stripe cancel failed: ${cancelRes.status}`)
        }
        cancelAt = new Date(activeSub.current_period_end * 1000).toISOString()
      }
    } catch (stripeErr) {
      console.error('applyAdvisorConnectionBilling stripe cancel:', stripeErr)
      billingTransferred = false
    }
  }

  const { error: linkError } = await admin
    .from('advisor_clients')
    .update({
      previous_consumer_tier: previousTier,
      billing_transferred: billingTransferred,
      billing_transferred_at: new Date().toISOString(),
      consumer_subscription_cancel_at: cancelAt,
    })
    .eq('id', advisorClientRowId)

  if (linkError) {
    console.error('applyAdvisorConnectionBilling link update:', linkError)
  }

  return { ok: true, previousTier, cancelAt, billingTransferred }
}

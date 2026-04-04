import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { FIRM_PRICE_ID_TO_TIER, PRICE_ID_TO_TIER } from '@/lib/tiers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function mapFirmSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return status
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const firmId = session.metadata?.firm_id
        if (firmId) {
          const subscriptionId = session.subscription as string | null
          console.log('checkout.session.completed — firm_id:', firmId)
          console.log('checkout.session.completed — subscription:', subscriptionId)
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = sub.items.data[0]?.price.id
            const firmTier = priceId
              ? FIRM_PRICE_ID_TO_TIER[priceId]
              : undefined
            const update: {
              stripe_subscription_id: string
              subscription_status: 'active'
              tier?: string
            } = {
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            }
            if (firmTier) {
              update.tier = firmTier
            }
            const { data, error } = await supabase
              .from('firms')
              .update(update)
              .eq('id', firmId)
              .select()
            console.log('Firm Supabase update data:', JSON.stringify(data))
            console.log('Firm Supabase update error:', JSON.stringify(error))
            console.log('Firm subscription activated:', firmId)
          } else {
            console.log('Firm checkout without subscription id — skipping firm update')
          }
          break
        }
        const userId = session.metadata?.userId
        console.log('checkout.session.completed — userId:', userId)
        console.log('checkout.session.completed — customer:', session.customer)
        console.log('checkout.session.completed — subscription:', session.subscription)
        if (userId) {
          const subId = session.subscription as string | null
          let renewalIso: string | null = null
          let priceId: string | null = null
          let consumerTier: number | null = null
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId)
            renewalIso = new Date(sub.current_period_end * 1000).toISOString()
            priceId = sub.items.data[0]?.price.id ?? null
            consumerTier = priceId ? (PRICE_ID_TO_TIER[priceId] ?? null) : null
          }
          const { data, error } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              subscription_plan: priceId,
              ...(consumerTier ? { consumer_tier: consumerTier } : {}),
              ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
            })
            .eq('id', userId)
            .select()
          console.log('Supabase update data:', JSON.stringify(data))
          console.log('Supabase update error:', JSON.stringify(error))
          console.log('Subscription activated for user:', userId)
        } else {
          console.log('No userId in metadata — skipping update')
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const firmId = subscription.metadata?.firm_id
        if (firmId) {
          await supabase
            .from('firms')
            .update({ subscription_status: 'canceled' })
            .eq('id', firmId)
          console.log('Firm subscription canceled:', firmId)
          break
        }
        const customerId = subscription.customer as string
        await supabase
          .from('profiles')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_customer_id', customerId)
        console.log('Subscription canceled for customer:', customerId)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const firmId = subscription.metadata?.firm_id
        if (firmId) {
          const mappedStatus = mapFirmSubscriptionStatus(subscription.status)
          await supabase
            .from('firms')
            .update({ subscription_status: mappedStatus })
            .eq('id', firmId)
          console.log('Firm subscription updated:', firmId, mappedStatus)
          break
        }
        const customerId = subscription.customer as string
        const renewalIso = new Date(
          subscription.current_period_end * 1000
        ).toISOString()
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_period_end: renewalIso,
          })
          .eq('stripe_customer_id', customerId)
        console.log('Subscription updated for customer:', customerId)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        let firmId =
          invoice.metadata?.firm_id ??
          invoice.subscription_details?.metadata?.firm_id
        // Fallback: retrieve subscription metadata if invoice metadata missing
        if (!firmId && invoice.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
            firmId = sub.metadata?.firm_id ?? null
          } catch (e) {
            console.error('invoice.payment_failed: failed to retrieve subscription for firm_id fallback', e)
          }
        }
        if (firmId) {
          await supabase
            .from('firms')
            .update({ subscription_status: 'past_due' })
            .eq('id', firmId)
          console.log('Firm invoice payment failed, past_due:', firmId)
          break
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}

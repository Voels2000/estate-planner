import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        if (userId) {
          const subId = session.subscription as string | null
          let renewalIso: string | null = null
          let stripeSubId: string | null = null
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId)
            stripeSubId = sub.id
            renewalIso = new Date(sub.current_period_end * 1000).toISOString()
          }
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              ...(stripeSubId ? { stripe_subscription_id: stripeSubId } : {}),
              ...(renewalIso ? { subscription_renewal_date: renewalIso } : {}),
            })
            .eq('id', userId)
          console.log('Subscription activated for user:', userId)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
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
        const customerId = subscription.customer as string
        const renewalIso = new Date(
          subscription.current_period_end * 1000
        ).toISOString()
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_renewal_date: renewalIso,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId)
        console.log('Subscription updated for customer:', customerId)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}

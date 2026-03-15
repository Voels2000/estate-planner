import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature error:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId) break

      const updates: { subscription_status: string; subscription_plan: string | null; stripe_customer_id?: string; stripe_subscription_id?: string } = {
        subscription_status: 'active',
        subscription_plan: null,
      }
      if (session.customer) updates.stripe_customer_id = session.customer as string
      if (session.subscription) updates.stripe_subscription_id = session.subscription as string

      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        updates.subscription_plan = subscription.items.data[0]?.price.id ?? null
      }

      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const priceId = subscription.items.data[0]?.price.id ?? null

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_plan: priceId,
          })
          .eq('id', profile.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_plan: null,
          })
          .eq('id', profile.id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

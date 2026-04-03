import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    if (profile.subscription_status === 'canceled') {
      return NextResponse.json({ error: 'Subscription already canceled' }, { status: 400 })
    }

    // Cancel at period end — user keeps access until paid-through date
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Update profile to reflect pending cancellation
    await supabase
      .from('profiles')
      .update({ subscription_status: 'canceled' })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

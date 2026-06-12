import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

const ACTIVE_FIRM_STATUSES = ['active', 'trialing', 'canceling', 'past_due']

export async function POST() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, role, is_attorney')
      .eq('id', user.id)
      .single()

    const { data: firm } = await supabase
      .from('firms')
      .select('stripe_customer_id, subscription_status')
      .eq('owner_id', user.id)
      .maybeSingle()

    const siteUrl = getAppUrl()
    let customerId = profile?.stripe_customer_id ?? null
    let returnUrl = `${siteUrl}/billing`

    if (
      firm?.stripe_customer_id &&
      ACTIVE_FIRM_STATUSES.includes(firm.subscription_status ?? '')
    ) {
      customerId = firm.stripe_customer_id
      returnUrl = `${siteUrl}/advisor/firm`
    } else if (profile?.role === 'attorney' || profile?.is_attorney) {
      returnUrl = `${siteUrl}/attorney/billing`
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

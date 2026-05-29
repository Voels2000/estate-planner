import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { ATTORNEY_PLAN_PRICE_IDS, type AttorneyPlanKey } from '@/lib/tiers'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planKey, returnTo } = (await req.json()) as {
      planKey?: string
      returnTo?: string
    }

    const validPlanKeys = Object.keys(ATTORNEY_PLAN_PRICE_IDS)
    if (!planKey || !validPlanKeys.includes(planKey)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId = ATTORNEY_PLAN_PRICE_IDS[planKey as AttorneyPlanKey]

    if (priceId.startsWith('TODO_')) {
      return NextResponse.json(
        { error: 'Attorney billing not yet configured. Please contact support.' },
        { status: 503 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com'
    const successUrl = `${baseUrl}/attorney/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = returnTo
      ? `${baseUrl}/attorney/billing?canceled=true&returnTo=${encodeURIComponent(returnTo)}`
      : `${baseUrl}/attorney/billing?canceled=true`

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, planKey },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Attorney Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

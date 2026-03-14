import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

const PRICE_IDS: Record<string, string> = {
  consumer: 'price_1TAlJjCaljka9gJthGTMogQb',
  advisor: 'price_1TAlRkCaljka9gJtL7jcTwWY',
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Support both JSON body (priceId) and query param (plan)
    const url = new URL(req.url)
    const planParam = url.searchParams.get('plan')

    let priceId: string | undefined

    if (planParam) {
      priceId = PRICE_IDS[planParam]
    } else {
      const body = await req.json().catch(() => ({}))
      priceId = body.priceId ?? PRICE_IDS[body.plan]
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
      },
    })

    return NextResponse.redirect(session.url!, 303)
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const PRICE_IDS: Record<string, string> = {
  // Consumer tiers
  financial:  'price_1TD2SMCaljka9gJtsbsXsPjC',
  retirement: 'price_1TD2TECaljka9gJtp8fpf3Yk',
  estate:     'price_1TD2WZCaljka9gJt5xUAnv4J',
  // Advisor tiers
  advisor:         'price_1TAlRkCaljka9gJtL7jcTwWY',
  advisor_pro:     'price_1TBIjWCaljka9gJt5tAXddM7',
  advisor_unlimited: 'price_1TBIkSCaljka9gJtUqwl9reU',
  // Legacy
  consumer: 'price_1TAlJjCaljka9gJthGTMogQb',
}

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: { userId: user.id },
    })

    return NextResponse.redirect(session.url!, 303)
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
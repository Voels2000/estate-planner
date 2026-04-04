import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const PRICE_IDS: Record<string, string> = {
  // Consumer tiers
  financial:  'price_1TILBRCaljka9gJt6dr44Znq',
  retirement: 'price_1TILEXCaljka9gJtrHqnG3bl',
  estate:     'price_1TILGOCaljka9gJtCDLiKFHp',
  // Advisor tiers
  advisor:           'price_1TAlRkCaljka9gJtL7jcTwWY',
  advisor_pro:       'price_1TBIjWCaljka9gJt5tAXddM7',
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
    let returnTo: string | undefined

    if (planParam) {
      priceId = PRICE_IDS[planParam]
    } else {
      const body = await req.json().catch(() => ({}))
      priceId = body.priceId ?? PRICE_IDS[body.plan]
      // FIX: read returnTo from request body so gated pages can pass their path
      returnTo = typeof body.returnTo === 'string' ? body.returnTo : undefined
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // FIX: build success_url using returnTo if provided.
    // Fall back to /profile for new users, /dashboard for returning users.
    let successUrl: string
    if (returnTo) {
      // Sanitize — only allow relative paths starting with /
      const safePath = returnTo.startsWith('/') ? returnTo : '/dashboard'
      successUrl = `${baseUrl}${safePath}?success=true&session_id={CHECKOUT_SESSION_ID}`
    } else {
      const { data: profileRole } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileRole?.role === 'advisor') {
        successUrl = `${baseUrl}/terms?returnTo=/advisor&session_id={CHECKOUT_SESSION_ID}`
      } else {
        const { data: household } = await supabase
          .from('households')
          .select('person1_name')
          .eq('owner_id', user.id)
          .single()
        const isNewUser = !household?.person1_name
        successUrl = isNewUser
          ? `${baseUrl}/terms?returnTo=/profile&session_id={CHECKOUT_SESSION_ID}`
          : `${baseUrl}/terms?returnTo=/dashboard&session_id={CHECKOUT_SESSION_ID}`
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      // FIX: preserve returnTo in cancel_url so back-navigation works correctly
      cancel_url: returnTo
        ? `${baseUrl}/billing?canceled=true&returnTo=${encodeURIComponent(returnTo)}`
        : `${baseUrl}/billing?canceled=true`,
      metadata: { userId: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

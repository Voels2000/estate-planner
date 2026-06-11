import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import {
  getPriceConfig,
  getTierFromPriceId,
  type BillingPeriod,
  type PlanTier,
} from '@/lib/billing/stripePrices'

const PLAN_NAME_TO_TIER: Record<string, PlanTier> = {
  financial: 1,
  retirement: 2,
  estate: 3,
  starter: 1,
}

export async function POST(req: Request) {
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

    const url = new URL(req.url)
    const planParam = url.searchParams.get('plan')
    const periodParam = url.searchParams.get('period') as BillingPeriod | null

    let priceId: string | undefined
    let returnTo: string | undefined
    let trialDays = 0

    if (planParam) {
      const tier = PLAN_NAME_TO_TIER[planParam]
      const period: BillingPeriod =
        periodParam === 'annual' ? 'annual' : 'monthly'
      if (tier) {
        const config = getPriceConfig(tier, period)
        priceId = config.priceId
        trialDays = config.trialDays
      }
    } else {
      const body = await req.json().catch(() => ({}))
      returnTo = typeof body.returnTo === 'string' ? body.returnTo : undefined

      if (typeof body.priceId === 'string') {
        priceId = body.priceId
        const tier = getTierFromPriceId(body.priceId)
        if (tier) {
          const period: BillingPeriod =
            body.period === 'annual' ? 'annual' : 'monthly'
          try {
            trialDays = getPriceConfig(tier, period).trialDays
          } catch {
            trialDays = 0
          }
        }
      } else if (body.tier != null) {
        const tier = Number(body.tier) as PlanTier
        const period: BillingPeriod =
          body.period === 'annual' ? 'annual' : 'monthly'
        if (tier >= 1 && tier <= 3) {
          const config = getPriceConfig(tier, period)
          priceId = config.priceId
          trialDays = config.trialDays
        }
      } else if (body.plan) {
        const tier = PLAN_NAME_TO_TIER[String(body.plan)]
        if (tier) {
          const period: BillingPeriod =
            body.period === 'annual' ? 'annual' : 'monthly'
          const config = getPriceConfig(tier, period)
          priceId = config.priceId
          trialDays = config.trialDays
        }
      }
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Consumer-only route — advisor uses /api/stripe/firm-checkout, attorney uses /api/stripe/attorney-checkout
    if (getTierFromPriceId(priceId) == null) {
      return NextResponse.json(
        { error: 'Invalid plan. Use firm or attorney checkout for professional subscriptions.' },
        { status: 400 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let successUrl: string
    if (returnTo) {
      const safePath = returnTo.startsWith('/') ? returnTo : '/dashboard'
      successUrl = `${baseUrl}${safePath}?success=true&session_id={CHECKOUT_SESSION_ID}`
    } else {
      const { data: profileRole } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileRole?.role === 'advisor') {
        successUrl = `${baseUrl}/advisor?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      } else {
        const { data: household } = await supabase
          .from('households')
          .select('person1_name')
          .eq('owner_id', user.id)
          .single()
        const isNewUser = !household?.person1_name
        successUrl = isNewUser
          ? `${baseUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`
          : `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: returnTo
        ? `${baseUrl}/billing?canceled=true&returnTo=${encodeURIComponent(returnTo)}`
        : `${baseUrl}/billing?canceled=true`,
      metadata: { userId: user.id },
      subscription_data:
        trialDays > 0 ? { trial_period_days: trialDays } : undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

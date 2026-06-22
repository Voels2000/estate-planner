import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createStripeClient } from '@/lib/stripe/config'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { processConsumerCheckout } from '@/lib/billing/processConsumerCheckout'
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
  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)

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

    const { data: billingProfile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_plan, stripe_customer_id')
      .eq('id', user.id)
      .single()

    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
      .maybeSingle()

    const result = await processConsumerCheckout({
      user,
      priceId,
      trialDays,
      returnTo,
      billingProfile,
      isAdvisorClient: !!clientRow,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      stripe,
      supabase,
      admin: createAdminClient(),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.block.message, code: result.block.code },
        { status: result.block.httpStatus },
      )
    }

    return NextResponse.json({ url: result.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

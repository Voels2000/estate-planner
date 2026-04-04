import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const VALID_FIRM_PRICE_IDS = new Set(Object.values(ADVISOR_FIRM_PRICE_IDS))

export async function POST(req: Request) {
  try {
    const ctx = await getAccessContext()

    if (!ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdvisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!ctx.isFirmOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const priceId = typeof body.priceId === 'string' ? body.priceId : undefined
    if (!priceId || !VALID_FIRM_PRICE_IDS.has(priceId)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const firmId = ctx.firm_id
    if (!firmId) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, stripe_customer_id, subscription_status')
      .eq('id', firmId)
      .maybeSingle()

    if (firmError || !firm) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const subStatus = firm.subscription_status
    if (subStatus === 'active' || subStatus === 'trialing') {
      return NextResponse.json(
        { error: 'Firm already has an active subscription.' },
        { status: 400 },
      )
    }

    let stripeCustomerId = firm.stripe_customer_id
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        metadata: { firm_id: firmId },
      })
      stripeCustomerId = customer.id

      const admin = createAdminClient()
      const { error: updateError } = await admin
        .from('firms')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', firmId)

      if (updateError) {
        console.error('Failed to persist Stripe customer id:', updateError)
        throw updateError
      }
    }

    const seatCount = Math.max(1, ctx.seat_count ?? 1)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: seatCount }],
      success_url: `${siteUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/billing`,
      metadata: { firm_id: firmId },
      subscription_data: { metadata: { firm_id: firmId } },
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}

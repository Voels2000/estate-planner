import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'
import { getAppUrl } from '@/lib/app-url'
import { createStripeClient } from '@/lib/stripe/config'
import {
  allowedAdvisorFirmCheckoutPriceIds,
  isAdvisorConnectionCheckoutPrice,
  normalizeFirmCheckoutQuantity,
} from '@/lib/billing/resolveAdvisorFirmCheckout'

export async function POST(req: Request) {
  try {
    const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
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
    const validPriceIds = allowedAdvisorFirmCheckoutPriceIds()

    if (!priceId || !validPriceIds.has(priceId)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    if (
      !isAdvisorConnectionCheckoutPrice(priceId) &&
      priceId === ADVISOR_FIRM_PRICE_IDS.enterprise
    ) {
      return NextResponse.json(
        { error: 'Enterprise plans require contacting sales at support@mywealthmaps.com.' },
        { status: 403 },
      )
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

    const quantityResult = normalizeFirmCheckoutQuantity(
      priceId,
      body.seatCount,
      ctx.seat_count ?? 1,
    )
    if (quantityResult.error) {
      return NextResponse.json({ error: quantityResult.error }, { status: 400 })
    }

    const siteUrl = getAppUrl()

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: quantityResult.quantity }],
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      success_url: `${siteUrl}/advisor?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/advisor`,
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

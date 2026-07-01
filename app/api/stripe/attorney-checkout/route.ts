import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTORNEY_PLAN_PRICE_IDS, type AttorneyPlanKey } from '@/lib/tiers'
import { createStripeClient } from '@/lib/stripe/config'
import { getOrigin } from '@/lib/app-url'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { getAttorneyListingBillingContext } from '@/lib/billing/attorneyConnectionStickyFloor'
import {
  isAttorneyConnectionCheckoutPrice,
  normalizeAttorneyCheckoutQuantity,
  resolveAttorneyCheckoutPriceId,
} from '@/lib/billing/resolveAttorneyCheckout'

export async function POST(req: NextRequest) {
  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_attorney, role, stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .single()
    if (!profile?.is_attorney && profile?.role !== 'attorney') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const listingId = await getAttorneyListingIdForUser(supabase, user.id)
    if (!listingId) {
      return NextResponse.json({ error: 'Attorney listing not found' }, { status: 404 })
    }

    const { planKey, returnTo, quantity: requestedQuantity } = (await req.json()) as {
      planKey?: string
      returnTo?: string
      quantity?: number
    }

    const connectionBilling = isConnectionBillingEnabled()
    const priceId = connectionBilling
      ? resolveAttorneyCheckoutPriceId(planKey)
      : ATTORNEY_PLAN_PRICE_IDS[(planKey as AttorneyPlanKey) ?? 'starter']

    if (!connectionBilling) {
      const validPlanKeys = Object.keys(ATTORNEY_PLAN_PRICE_IDS)
      if (!planKey || !validPlanKeys.includes(planKey)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      }
    }

    if (priceId.startsWith('TODO_') || !priceId) {
      return NextResponse.json(
        { error: 'Attorney billing not yet configured. Please contact support.' },
        { status: 503 },
      )
    }

    if (connectionBilling) {
      const subStatus = profile?.subscription_status
      if (subStatus === 'active' || subStatus === 'trialing') {
        return NextResponse.json(
          { error: 'You already have an active subscription. Raise your client limit instead.' },
          { status: 400 },
        )
      }
    }

    const admin = createAdminClient()
    const connected = connectionBilling
      ? await attorneyConnectedHouseholds(admin, listingId)
      : 0
    const listingCtx = connectionBilling
      ? await getAttorneyListingBillingContext(admin, listingId)
      : null

    const quantityResult = normalizeAttorneyCheckoutQuantity(
      priceId,
      requestedQuantity,
      connected,
      listingCtx?.billingFloor,
    )
    if (quantityResult.error) {
      return NextResponse.json({ error: quantityResult.error }, { status: 400 })
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, attorney_listing_id: listingId },
      })
      stripeCustomerId = customer.id

      await admin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id)
    }

    const baseUrl = getOrigin(req)
    const successUrl = `${baseUrl}/attorney/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = returnTo
      ? `${baseUrl}/attorney/billing?canceled=true&returnTo=${encodeURIComponent(returnTo)}`
      : `${baseUrl}/attorney/billing?canceled=true`

    const useConnectionPrice = isAttorneyConnectionCheckoutPrice(priceId)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: quantityResult.quantity }],
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      ...(useConnectionPrice
        ? {
            automatic_tax: { enabled: true },
            customer_update: { address: 'auto' },
          }
        : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        attorney_listing_id: listingId,
        ...(planKey ? { planKey } : {}),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          attorney_listing_id: listingId,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Attorney Stripe checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

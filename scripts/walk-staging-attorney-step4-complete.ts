/**
 * Continue attorney staging walk after accept #2 hits checkout gate:
 * simulate checkout (Stripe test sub) → accept #2 → raise 2→3 → accept #3 → verify qty 2 / $150.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-attorney-step4-complete.ts
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { attorneyConnectedHouseholds } from '../lib/billing/connectedHouseholdCount'
import { resolveAttorneyBillableQuantity } from '../lib/billing/attorneyBillableQuantity'
import {
  applyAttorneyListingCheckoutCompletedUpdate,
  buildAttorneyListingCheckoutCompletedUpdate,
  buildAttorneyProfileCheckoutFields,
} from '../lib/billing/attorneyCheckoutWebhook'
import { attorneyConnectionLimitSeedFromCheckoutQuantity } from '../lib/billing/attorneyBillableQuantity'
import { isConnectionBillingEnabled } from '../lib/billing/connectionBillingFlag'
import { resolveConnectionStripePriceIds, rateForCount, ATTORNEY_BANDS, ATTORNEY_FLOOR } from '../lib/pricing/connectionPricing'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  buildSupabaseAuthCookieHeader,
  createE2eAuthSessionForEmail,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'
import { ENVIRONMENTS } from './testEnv'

const BASE_URL = ENVIRONMENTS.staging.baseURL

async function apiJson(
  path: string,
  cookie: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { Cookie: cookie }
  let body: string | undefined
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
    body,
  })
  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = { raw: text.slice(0, 400) }
  }
  return { status: res.status, body: parsed }
}

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY unset')

  const stripe = new Stripe(stripeKey)
  const attorneyEmail = E2E_IDENTITIES.attorneyPortal.email
  const attorneyId = await findUserIdByEmail(attorneyEmail)
  if (!attorneyId) throw new Error(`Attorney not found: ${attorneyEmail}`)

  const { data: listing } = await admin
    .from('attorney_listings')
    .select('id, client_limit, billing_floor')
    .eq('profile_id', attorneyId)
    .single()
  if (!listing?.id) throw new Error('Listing missing')

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', attorneyId)
    .single()

  const priceId = resolveConnectionStripePriceIds().attorney
  if (!priceId) throw new Error('Attorney connection price id unset')

  let customerId = profile?.stripe_customer_id?.trim() ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: attorneyEmail,
      metadata: { user_id: attorneyId, attorney_listing_id: listing.id },
    })
    customerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', attorneyId)
  }

  if (!profile?.stripe_subscription_id || profile.subscription_status !== 'active') {
    console.log('\n=== Simulating checkout (Stripe test subscription qty=1) ===')
    const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })
    await stripe.paymentMethods.attach(pm.id, { customer: customerId })
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pm.id },
    })

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: attorneyId, attorney_listing_id: listing.id },
    })

    const listingUpdate = buildAttorneyListingCheckoutCompletedUpdate({
      stripeQuantity: 1,
      priceId,
    })
    const seed =
      listingUpdate.client_limit != null
        ? listingUpdate
        : attorneyConnectionLimitSeedFromCheckoutQuantity(1)
    const { error: listingErr } = await applyAttorneyListingCheckoutCompletedUpdate(
      admin,
      listing.id,
      seed,
    )
    if (listingErr) throw new Error(listingErr)

    const profileFields = buildAttorneyProfileCheckoutFields(sub, customerId, priceId)
    await admin.from('profiles').update(profileFields).eq('id', attorneyId)
    console.log(`  subscription ${sub.id} active; listing limit=${seed.client_limit} floor=${seed.billing_floor}`)
    console.log(`  CONNECTION_BILLING_ENABLED=${isConnectionBillingEnabled() ? 'true' : 'false'} (staging app must be true)`)
  } else {
    console.log('\n=== Active subscription already present — skipping checkout sim ===')
  }

  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(attorneyEmail)
  const cookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

  const { data: pending } = await admin
    .from('attorney_clients')
    .select('id, status')
    .eq('attorney_id', listing.id)
    .eq('status', 'consumer_requested')
    .order('created_at', { ascending: true })

  if (!pending?.length) throw new Error('No pending consumer_requested rows')

  console.log('\n=== Accept #2 (post-checkout) ===')
  const accept2 = await apiJson('/api/attorney/accept-request', cookie, {
    method: 'POST',
    json: { attorney_client_id: pending[0].id },
  })
  console.log(`  → ${accept2.status} ${JSON.stringify(accept2.body)}`)
  if (accept2.status !== 200) process.exit(1)

  const connected2 = await attorneyConnectedHouseholds(admin, listing.id)
  console.log(`  connected=${connected2} (expect 2)`)

  const pendingAfter2 = pending.slice(1)
  if (!pendingAfter2.length) throw new Error('No row for accept #3')

  console.log('\n=== Accept #3 (expect limit_raise_required) ===')
  const accept3Gate = await apiJson('/api/attorney/accept-request', cookie, {
    method: 'POST',
    json: { attorney_client_id: pendingAfter2[0].id },
  })
  console.log(`  → ${accept3Gate.status} ${JSON.stringify(accept3Gate.body)}`)
  if (accept3Gate.status !== 402 || accept3Gate.body.error !== 'limit_raise_required') {
    console.error('\n✗ Expected limit_raise_required at 2/2 capacity')
    process.exit(1)
  }
  console.log('  ✓ limit_raise_required at capacity')

  console.log('\n=== Raise limit 2 → 3 ===')
  const raise = await apiJson('/api/attorney/connection-limit/raise', cookie, {
    method: 'POST',
    json: { new_client_limit: 3 },
  })
  console.log(`  → ${raise.status} ${JSON.stringify(raise.body)}`)
  if (raise.status !== 200) process.exit(1)
  console.log('  ✓ Confirm raise works (API)')

  const { data: listingAfterRaise } = await admin
    .from('attorney_listings')
    .select('client_limit')
    .eq('id', listing.id)
    .single()
  console.log(`  client_limit=${listingAfterRaise?.client_limit} (expect 3)`)

  console.log('\n=== Accept #3 (post-raise, no checkout) ===')
  const accept3 = await apiJson('/api/attorney/accept-request', cookie, {
    method: 'POST',
    json: { attorney_client_id: pendingAfter2[0].id },
  })
  console.log(`  → ${accept3.status} ${JSON.stringify(accept3.body)}`)
  if (accept3.status !== 200) process.exit(1)

  const connected3 = await attorneyConnectedHouseholds(admin, listing.id)
  const { data: listingFinal } = await admin
    .from('attorney_listings')
    .select('billing_floor')
    .eq('id', listing.id)
    .single()
  const billable = resolveAttorneyBillableQuantity(connected3, listingFinal?.billing_floor ?? 0)
  const mrr = billable * rateForCount(billable, ATTORNEY_BANDS, ATTORNEY_FLOOR)

  const { data: profFinal } = await admin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', attorneyId)
    .single()

  let stripeQty: number | null = null
  if (profFinal?.stripe_subscription_id) {
    const sub = await stripe.subscriptions.retrieve(profFinal.stripe_subscription_id)
    stripeQty = sub.items.data[0]?.quantity ?? null
  }

  console.log('\n=== Step 4 proof ===')
  console.log(`  connected=${connected3} billable=${billable} stripe_qty=${stripeQty} mrr=$${mrr}/mo`)

  const ok =
    connected3 === 3 &&
    billable === 2 &&
    stripeQty === 2 &&
    mrr === 150

  if (ok) {
    console.log('\n✓ PASS — raise 2→3, accept 3rd, qty 2 / $150, no second checkout')
  } else {
    console.error('\n✗ FAIL — counts do not match expected 3 connected / billable 2 / qty 2 / $150')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

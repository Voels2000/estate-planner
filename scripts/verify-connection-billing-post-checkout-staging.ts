/**
 * Post-checkout verification for connection billing spine (staging).
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/verify-connection-billing-post-checkout-staging.ts
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { ENVIRONMENTS } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  buildSupabaseAuthCookieHeader,
  createE2eAuthSessionForEmail,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'
import { firmConnectedHouseholds } from '../lib/billing/connectedHouseholdCount'

const BASE_URL = ENVIRONMENTS.staging.baseURL

type Step = { name: string; ok: boolean; detail: string }
const results: Step[] = []

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}: ${detail}`)
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}: ${detail}`)
}

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
    parsed = { raw: text.slice(0, 300) }
  }
  return { status: res.status, body: parsed }
}

async function main() {
  initSupabaseEnv()
  console.log(`\nPost-checkout verification — ${BASE_URL}\n`)

  const connectionPriceId = process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY?.trim()
  if (!connectionPriceId) {
    fail('preflight', 'STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY unset')
    process.exit(1)
  }
  pass('preflight', `connection price ${connectionPriceId}`)

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey) {
    fail('preflight', 'STRIPE_SECRET_KEY unset')
    process.exit(1)
  }
  const stripe = new Stripe(stripeKey)

  const ownerEmail = E2E_IDENTITIES.advisorEmpty.email
  const consumerEmail = E2E_IDENTITIES.consumerTier1.email
  const ownerId = await findUserIdByEmail(ownerEmail)
  const consumerId = await findUserIdByEmail(consumerEmail)

  if (!ownerId) {
    fail('fixture', `owner not found: ${ownerEmail}`)
    process.exit(1)
  }
  if (!consumerId) {
    fail('fixture', `consumer not found: ${consumerEmail}`)
    process.exit(1)
  }

  const admin = createAdminClient()

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('subscription_status, firm_id, firm_role')
    .eq('id', ownerId)
    .single()

  const { data: firm } = await admin
    .from('firms')
    .select(
      'id, name, subscription_status, seat_count, stripe_customer_id, stripe_subscription_id, tier',
    )
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!firm?.id) {
    fail('firm-db', 'firm row missing')
    process.exit(1)
  }

  const subStatus = firm.subscription_status ?? 'null'
  const seatCount = firm.seat_count ?? 'null'
  const subId = firm.stripe_subscription_id ?? null

  if (firm.subscription_status === 'active' || firm.subscription_status === 'trialing') {
    pass('firm-db', `subscription_status=${subStatus}, seat_count=${seatCount}, tier=${firm.tier ?? 'null'}`)
  } else {
    fail(
      'firm-db',
      `expected active/trialing, got ${subStatus} (webhook may not have fired yet)`,
    )
  }

  if (firm.stripe_customer_id) {
    pass('firm-db', `stripe_customer_id=${firm.stripe_customer_id}`)
  } else {
    fail('firm-db', 'stripe_customer_id missing')
  }

  if (subId) {
    pass('firm-db', `stripe_subscription_id=${subId}`)
  } else {
    fail('firm-db', 'stripe_subscription_id missing — checkout webhook not applied')
  }

  if (ownerProfile?.subscription_status === 'active') {
    pass('owner-profile', 'subscription_status=active')
  } else {
    fail('owner-profile', `subscription_status=${ownerProfile?.subscription_status ?? 'null'}`)
  }

  let stripeQty: number | null = null
  let stripePriceId: string | null = null
  let stripeStatus: string | null = null

  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      stripeQty = sub.items.data[0]?.quantity ?? null
      stripePriceId = sub.items.data[0]?.price.id ?? null
      stripeStatus = sub.status
      pass('stripe-sub', `status=${sub.status}, quantity=${stripeQty}, price=${stripePriceId}`)

      if (stripePriceId === connectionPriceId) {
        pass('stripe-sub', 'price matches STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY')
      } else {
        fail(
          'stripe-sub',
          `price ${stripePriceId} != connection price ${connectionPriceId}`,
        )
      }

      if (stripeStatus === 'active' || stripeStatus === 'trialing') {
        pass('stripe-sub', `subscription is ${stripeStatus}`)
      } else {
        fail('stripe-sub', `unexpected status ${stripeStatus}`)
      }
    } catch (err) {
      fail('stripe-sub', err instanceof Error ? err.message : String(err))
    }
  }

  const connected = await firmConnectedHouseholds(admin, firm.id)
  pass('connected-households', `firm billable count=${connected}`)

  const { data: pendingLink } = await admin
    .from('advisor_clients')
    .select('id, status, client_id')
    .eq('advisor_id', ownerId)
    .eq('client_id', consumerId)
    .maybeSingle()

  if (pendingLink?.id) {
    pass('advisor-link', `link ${pendingLink.id} status=${pendingLink.status}`)
  } else {
    fail('advisor-link', 'no advisor_clients row for e2e consumer')
  }

  const { data: consumerBefore } = await admin
    .from('profiles')
    .select('subscription_status, stripe_subscription_id, consumer_tier')
    .eq('id', consumerId)
    .single()

  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(ownerEmail)
  const ownerCookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

  if (pendingLink?.status === 'consumer_requested') {
    const accept = await apiJson('/api/advisor/accept-request', ownerCookie, {
      method: 'POST',
      json: { advisor_client_id: pendingLink.id },
    })

    if (accept.status === 200 || accept.status === 201) {
      pass('accept-after-checkout', `accept succeeded (${accept.status})`)
    } else if (accept.status === 402) {
      fail(
        'accept-after-checkout',
        `still gated 402 after checkout — firm sub not seen by API: ${JSON.stringify(accept.body)}`,
      )
    } else {
      fail(
        'accept-after-checkout',
        `unexpected ${accept.status}: ${JSON.stringify(accept.body)}`,
      )
    }
  } else if (pendingLink?.status === 'active') {
    pass('accept-after-checkout', 'link already active (accept skipped)')
  }

  const { data: linkAfter } = await admin
    .from('advisor_clients')
    .select('status')
    .eq('advisor_id', ownerId)
    .eq('client_id', consumerId)
    .maybeSingle()

  if (linkAfter?.status === 'active') {
    pass('link-active', 'advisor_clients status=active')
  } else {
    fail('link-active', `status=${linkAfter?.status ?? 'missing'}`)
  }

  const connectedAfter = await firmConnectedHouseholds(admin, firm.id)
  if (connectedAfter >= 1) {
    pass('connected-households', `after accept count=${connectedAfter}`)
  } else {
    fail('connected-households', `expected >=1 after accept, got ${connectedAfter}`)
  }

  if (subId) {
    try {
      const subAfter = await stripe.subscriptions.retrieve(subId)
      const qtyAfter = subAfter.items.data[0]?.quantity ?? null
      pass('stripe-qty-after-accept', `quantity=${qtyAfter} (checkout was ${stripeQty ?? '?'})`)

      const { data: firmLimits } = await admin
        .from('firms')
        .select('billing_floor, client_limit')
        .eq('id', firm.id)
        .single()

      const floor = firmLimits?.billing_floor ?? 0
      const expectedBillable = Math.max(connectedAfter, floor)

      if (qtyAfter === expectedBillable) {
        pass(
          'stripe-qty-sync',
          `Stripe quantity matches sticky billable max(connected=${connectedAfter}, floor=${floor})`,
        )
      } else if (qtyAfter === stripeQty && stripeQty !== expectedBillable) {
        fail(
          'stripe-qty-sync',
          `Stripe at ${qtyAfter} but expected sticky billable ${expectedBillable}`,
        )
      } else {
        pass(
          'stripe-qty-sync',
          `quantity=${qtyAfter}, connected=${connectedAfter}, floor=${floor}, client_limit=${firmLimits?.client_limit ?? 'null'}`,
        )
      }
    } catch (err) {
      fail('stripe-qty-after-accept', err instanceof Error ? err.message : String(err))
    }
  }

  const { data: consumerAfter } = await admin
    .from('profiles')
    .select('subscription_status, stripe_subscription_id, consumer_tier')
    .eq('id', consumerId)
    .single()

  pass(
    'consumer-billing',
    `before=${consumerBefore?.subscription_status}/${consumerBefore?.consumer_tier} → after=${consumerAfter?.subscription_status}/${consumerAfter?.consumer_tier}`,
  )

  const checkoutProbe = await apiJson('/api/stripe/firm-checkout', ownerCookie, {
    method: 'POST',
    json: { priceId: connectionPriceId, seatCount: 1 },
  })
  if (
    checkoutProbe.status === 400 &&
    checkoutProbe.body.error === 'Firm already has an active subscription.'
  ) {
    pass('no-duplicate-checkout', 'firm-checkout correctly rejects duplicate sub')
  } else {
    fail(
      'no-duplicate-checkout',
      `expected 400 duplicate, got ${checkoutProbe.status} ${JSON.stringify(checkoutProbe.body)}`,
    )
  }

  console.log('\n--- Summary ---')
  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
  console.log('\nPost-checkout spine OK.')
}

main().catch((err) => {
  console.error('\nVerification aborted:', err instanceof Error ? err.message : err)
  process.exit(1)
})

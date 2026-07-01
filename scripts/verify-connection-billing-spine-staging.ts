/**
 * Staging spine walk — API-automatable steps for connection billing (Part 6).
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/verify-connection-billing-spine-staging.ts
 *
 * Requires on staging Vercel:
 *   - CONNECTION_BILLING_ENABLED=true
 *   - STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY (main test account)
 *   - firm-checkout accepts connection price (PR #193+)
 */

import { createAdminClient } from '../lib/supabase/admin'
import { ENVIRONMENTS } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  buildSupabaseAuthCookieHeader,
  createE2eAuthSessionForEmail,
  ensureAdvisorEmptyForE2e,
  findUserIdByEmail,
} from './seed-e2e-lib'

const BASE_URL = ENVIRONMENTS.staging.baseURL

type StepResult = { name: string; ok: boolean; detail: string }

const results: StepResult[] = []

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}: ${detail}`)
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}: ${detail}`)
  throw new Error(`${name}: ${detail}`)
}

function skip(name: string, detail: string) {
  results.push({ name, ok: false, detail: `[SKIP] ${detail}` })
  console.warn(`⊘ ${name}: ${detail}`)
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
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body: parsed }
}

async function ensureConsumerRequestedLink(
  advisorId: string,
  clientUserId: string,
): Promise<string> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('advisor_clients')
    .select('id, status')
    .eq('advisor_id', advisorId)
    .eq('client_id', clientUserId)
    .maybeSingle()

  if (existing?.status === 'consumer_requested') return existing.id

  if (existing) {
    await admin.from('advisor_clients').delete().eq('id', existing.id)
  }

  const { data: inserted, error } = await admin
    .from('advisor_clients')
    .insert({
      advisor_id: advisorId,
      client_id: clientUserId,
      status: 'consumer_requested',
      invited_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`consumer_requested insert: ${error?.message ?? 'no row'}`)
  }
  return inserted.id
}

async function main() {
  console.log(`\nConnection billing spine — ${BASE_URL}\n`)

  const connectionPriceId = process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY?.trim()
  if (!connectionPriceId) {
    fail('preflight', 'STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY unset in runner env')
  }
  pass('preflight', `connection price ${connectionPriceId}`)

  const ownerEmail = E2E_IDENTITIES.advisorEmpty.email
  const consumerEmail = E2E_IDENTITIES.consumerTier1.email

  const ownerId = await ensureAdvisorEmptyForE2e()
  pass('fixture', `unpaid firm owner ${ownerEmail} (${ownerId})`)

  const admin = createAdminClient()
  const { data: firm } = await admin
    .from('firms')
    .select('id, subscription_status')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!firm?.id) fail('fixture', 'advisor-empty firm row missing')
  if (firm.subscription_status === 'active' || firm.subscription_status === 'trialing') {
    fail('fixture', `expected unpaid firm, got subscription_status=${firm.subscription_status}`)
  }
  pass('fixture', `firm ${firm.id} subscription_status=${firm.subscription_status ?? 'null'}`)

  const consumerId = await findUserIdByEmail(consumerEmail)
  if (!consumerId) fail('fixture', `no consumer ${consumerEmail}`)

  const { data: consumerBefore } = await admin
    .from('profiles')
    .select('subscription_status, stripe_subscription_id')
    .eq('id', consumerId)
    .single()

  const subBefore = consumerBefore?.subscription_status ?? null
  const stripeSubBefore = consumerBefore?.stripe_subscription_id ?? null

  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(ownerEmail)
  const ownerCookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

  const checkout = await apiJson('/api/stripe/firm-checkout', ownerCookie, {
    method: 'POST',
    json: { priceId: connectionPriceId, seatCount: 1 },
  })

  if (checkout.status === 400 && checkout.body.error === 'Bad request') {
    fail(
      'firm-checkout-connection-price',
      '400 Bad request — CONNECTION_BILLING_ENABLED off and/or connection checkout not deployed on staging',
    )
  }
  if (checkout.status === 400 && checkout.body.error === 'Firm already has an active subscription.') {
    skip('firm-checkout-connection-price', 'firm already subscribed — reset firm sub to continue spine')
  }
  if (!checkout.body.url || typeof checkout.body.url !== 'string') {
    fail(
      'firm-checkout-connection-price',
      `expected checkout URL, got ${checkout.status} ${JSON.stringify(checkout.body)}`,
    )
  }
  pass(
    'firm-checkout-connection-price',
    `checkout session ${String(checkout.body.url).slice(0, 48)}…`,
  )

  const linkId = await ensureConsumerRequestedLink(ownerId, consumerId)

  const accept = await apiJson('/api/advisor/accept-request', ownerCookie, {
    method: 'POST',
    json: { advisor_client_id: linkId },
  })

  if (accept.status !== 402) {
    fail(
      'first-connection-gate',
      `expected 402 firm_checkout_required, got ${accept.status} ${JSON.stringify(accept.body)}`,
    )
  }
  if (accept.body.error !== 'firm_checkout_required') {
    fail('first-connection-gate', `unexpected error ${JSON.stringify(accept.body)}`)
  }
  if (accept.body.quantity !== 1) {
    fail('first-connection-gate', `expected quantity 1, got ${String(accept.body.quantity)}`)
  }
  pass('first-connection-gate', '402 firm_checkout_required quantity=1')

  const { data: consumerAfter } = await admin
    .from('profiles')
    .select('subscription_status, stripe_subscription_id')
    .eq('id', consumerId)
    .single()

  if (
    consumerAfter?.subscription_status !== subBefore ||
    consumerAfter?.stripe_subscription_id !== stripeSubBefore
  ) {
    fail(
      'consumer-handoff-blocked',
      `consumer billing changed on gated accept (before=${subBefore}/${stripeSubBefore}, after=${consumerAfter?.subscription_status}/${consumerAfter?.stripe_subscription_id})`,
    )
  }
  pass('consumer-handoff-blocked', `consumer sub unchanged (${subBefore ?? 'null'})`)

  const { data: linkAfter } = await admin
    .from('advisor_clients')
    .select('status')
    .eq('id', linkId)
    .single()

  if (linkAfter?.status === 'active') {
    fail('first-connection-gate', 'connection activated despite 402 gate')
  }
  pass('first-connection-gate-db', `link still ${linkAfter?.status ?? 'unknown'} (not active)`)

  console.log('\n--- Summary ---')
  const failed = results.filter((r) => !r.ok && !r.detail.startsWith('[SKIP]'))
  const skipped = results.filter((r) => r.detail.startsWith('[SKIP]'))
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : r.detail.startsWith('[SKIP]') ? 'SKIP' : 'FAIL'}  ${r.name}`)
  }
  console.log(
    `\n${results.length - failed.length - skipped.length}/${results.length} passed` +
      (skipped.length ? `, ${skipped.length} skipped` : '') +
      (failed.length ? `, ${failed.length} FAILED` : ''),
  )

  if (failed.length) process.exit(1)
  console.log('\nAPI spine steps OK. Next: complete Stripe Checkout in browser, then re-run post-checkout steps.')
}

main().catch((err) => {
  console.error('\nSpine walk aborted:', err instanceof Error ? err.message : err)
  process.exit(1)
})

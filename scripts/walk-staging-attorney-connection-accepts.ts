/**
 * Seed consumer_requested rows (if needed) and walk attorney accept 1 → 2 → gate on 3.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-attorney-connection-accepts.ts
 *
 * Manual UI path: sign in as attorney → /attorney/requests → accept pending requests.
 * This script automates POST /api/attorney/accept-request for repeatable spine checks.
 */

import Stripe from 'stripe'
import { createAdminClient } from '../lib/supabase/admin'
import { ENVIRONMENTS } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { ensureAttorneyClientRequestRow } from '../lib/attorney/createAttorneyClientRequest'
import { attorneyConnectedHouseholds } from '../lib/billing/connectedHouseholdCount'
import {
  buildSupabaseAuthCookieHeader,
  createE2eAuthSessionForEmail,
  fetchHouseholdIdByOwnerId,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

const BASE_URL = ENVIRONMENTS.staging.baseURL

const CONSUMER_EMAILS = [
  E2E_IDENTITIES.consumerTier1.email,
  E2E_IDENTITIES.consumer.email,
  E2E_IDENTITIES.advisorClient.email,
] as const

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

async function listingSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string,
  stripe: Stripe | null,
  subId: string | null,
) {
  const connected = await attorneyConnectedHouseholds(admin, listingId)
  const { data: listing } = await admin
    .from('attorney_listings')
    .select('client_limit, billing_floor, reset_count, firm_name')
    .eq('id', listingId)
    .single()

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, attorney_tier, stripe_subscription_id')
    .eq('id', (
      await admin.from('attorney_listings').select('profile_id').eq('id', listingId).single()
    ).data?.profile_id ?? '')
    .maybeSingle()

  let stripeQty: number | null = null
  if (stripe && subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      stripeQty = sub.items.data[0]?.quantity ?? null
    } catch {
      stripeQty = null
    }
  }

  return { connected, listing, profile, stripeQty }
}

async function main() {
  const listOnly = process.argv.includes('--list-only')
  initSupabaseEnv()
  const admin = createAdminClient()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  const stripe = stripeKey ? new Stripe(stripeKey) : null

  const attorneyEmail = E2E_IDENTITIES.attorneyPortal.email
  const attorneyId = await findUserIdByEmail(attorneyEmail)
  if (!attorneyId) throw new Error(`Attorney not found: ${attorneyEmail}`)

  const { data: listingRow } = await admin
    .from('attorney_listings')
    .select('id, firm_name, referral_code')
    .eq('profile_id', attorneyId)
    .single()

  if (!listingRow?.id) throw new Error('Claimed attorney listing missing')

  const listingId = listingRow.id

  console.log(`\n=== Attorney fixture (${attorneyEmail}) ===`)
  console.log(`  listing_id: ${listingId}`)
  console.log(`  firm: ${listingRow.firm_name}`)
  console.log(`  referral: ${BASE_URL}/find-attorney?aref=${listingRow.referral_code ?? 'e2eatt01'}`)
  console.log(`  portal:   ${BASE_URL}/attorney`)
  console.log(`  billing:  ${BASE_URL}/attorney/billing`)
  console.log(`  requests: ${BASE_URL}/attorney/requests`)

  for (const email of CONSUMER_EMAILS) {
    const consumerId = await findUserIdByEmail(email)
    if (!consumerId) {
      console.log(`\n  SKIP seed request — no auth user: ${email}`)
      continue
    }
    const householdId = await fetchHouseholdIdByOwnerId(consumerId)
    const result = await ensureAttorneyClientRequestRow(admin, {
      attorneyListingId: listingId,
      consumerUserId: consumerId,
      requestMessage: `E2E connection request from ${email}`,
    })
    console.log(
      `\n  consumer_requested: ${email} household=${householdId ?? '?'} row=${result.rowId ?? 'existing/missing'}`,
    )
  }

  const { data: pending } = await admin
    .from('attorney_clients')
    .select('id, client_id, status, request_message, created_at')
    .eq('attorney_id', listingId)
    .eq('status', 'consumer_requested')
    .order('created_at', { ascending: true })

  if (!pending?.length) {
    console.log('\nNo pending consumer_requested rows — check consumer accounts / households.')
    process.exit(1)
  }

  console.log(`\n=== Pending requests (${pending.length}) — accept from /attorney/requests ===`)
  for (const row of pending) {
    const { data: household } = await admin
      .from('households')
      .select('owner_id')
      .eq('id', row.client_id)
      .maybeSingle()
    const ownerEmail =
      household?.owner_id
        ? (
            await admin.from('profiles').select('email').eq('id', household.owner_id).maybeSingle()
          ).data?.email
        : null
    console.log(`  ${ownerEmail ?? row.client_id}`)
    console.log(`    attorney_client_id: ${row.id}`)
    console.log(`    POST /api/attorney/accept-request { "attorney_client_id": "${row.id}" }`)
  }

  if (listOnly) {
    console.log('\n=== List-only — accept manually from /attorney/requests ===')
    return
  }

  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(attorneyEmail)
  const attorneyCookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

  const { data: profileBefore } = await admin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', attorneyId)
    .single()

  let snap = await listingSnapshot(
    admin,
    listingId,
    stripe,
    profileBefore?.stripe_subscription_id ?? null,
  )
  console.log('\n=== Before any accept ===')
  console.log(
    `connected=${snap.connected} client_limit=${snap.listing?.client_limit} billing_floor=${snap.listing?.billing_floor} stripe_qty=${snap.stripeQty} sub=${snap.profile?.subscription_status ?? 'null'}`,
  )

  const toAccept = pending.slice(0, 3)
  for (let i = 0; i < toAccept.length; i++) {
    const row = toAccept[i]
    console.log(`\n--- Accept #${i + 1}: ${row.id} ---`)

    const res = await apiJson('/api/attorney/accept-request', attorneyCookie, {
      method: 'POST',
      json: { attorney_client_id: row.id },
    })

    console.log(`  POST /api/attorney/accept-request → ${res.status}`)
    console.log(`  body: ${JSON.stringify(res.body)}`)

    const { data: profileNow } = await admin
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', attorneyId)
      .single()

    snap = await listingSnapshot(
      admin,
      listingId,
      stripe,
      profileNow?.stripe_subscription_id ?? null,
    )
    console.log(
      `  after: connected=${snap.connected} client_limit=${snap.listing?.client_limit} billing_floor=${snap.listing?.billing_floor} stripe_qty=${snap.stripeQty}`,
    )

    if (res.status === 402 && res.body.error === 'attorney_checkout_required') {
      console.log(`\n✓ Expected gate on accept #${i + 1} — attorney_checkout_required qty=${String(res.body.quantity)} (billable)`)
      break
    }
    if (res.status !== 200) {
      console.log('\n✗ Unexpected accept failure — stopping walk')
      process.exit(1)
    }
  }

  console.log('\n=== Walk complete ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

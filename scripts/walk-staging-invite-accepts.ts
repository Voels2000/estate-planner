/**
 * List pending advisor invites on staging and walk accept 1 → 2 → 3 (gate on 3rd).
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-invite-accepts.ts
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

async function firmSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  firmId: string,
  stripe: Stripe | null,
  subId: string | null,
) {
  const connected = await firmConnectedHouseholds(admin, firmId)
  const { data: firm } = await admin
    .from('firms')
    .select('subscription_status, client_limit, billing_floor, seat_count, stripe_subscription_id')
    .eq('id', firmId)
    .single()

  let stripeQty: number | null = null
  if (stripe && subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      stripeQty = sub.items.data[0]?.quantity ?? null
    } catch {
      stripeQty = null
    }
  }

  return { connected, firm, stripeQty }
}

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  const stripe = stripeKey ? new Stripe(stripeKey) : null

  const ownerEmail = E2E_IDENTITIES.advisorEmpty.email
  const ownerId = await findUserIdByEmail(ownerEmail)
  if (!ownerId) throw new Error(`Owner not found: ${ownerEmail}`)

  const { data: firm } = await admin
    .from('firms')
    .select('id, subscription_status, client_limit, billing_floor, stripe_subscription_id')
    .eq('owner_id', ownerId)
    .single()

  if (!firm?.id) throw new Error('Firm not found')

  console.log(`\n=== Firm state (${ownerEmail}) ===`)
  console.log(JSON.stringify(firm, null, 2))

  const { data: pending } = await admin
    .from('advisor_clients')
    .select('id, invited_email, invite_token, status, invite_expires_at')
    .eq('advisor_id', ownerId)
    .eq('status', 'pending')
    .order('invited_at', { ascending: true })

  if (!pending?.length) {
    console.log('\nNo pending invites — send invites from advisor UI first.')
    process.exit(1)
  }

  console.log(`\n=== Pending invites (${pending.length}) ===`)
  for (const row of pending) {
    const url = `${BASE_URL}/invite/${row.invite_token}`
    console.log(`  ${row.invited_email}`)
    console.log(`    ${url}`)
    console.log(`    expires: ${row.invite_expires_at}`)
  }

  let snap = await firmSnapshot(admin, firm.id, stripe, firm.stripe_subscription_id)
  console.log('\n=== Before any accept ===')
  console.log(
    `connected=${snap.connected} client_limit=${snap.firm?.client_limit} billing_floor=${snap.firm?.billing_floor} stripe_qty=${snap.stripeQty} sub=${snap.firm?.subscription_status}`,
  )

  const toAccept = pending.slice(0, 3)
  for (let i = 0; i < toAccept.length; i++) {
    const invite = toAccept[i]
    const email = invite.invited_email?.trim()
    if (!email) {
      console.log(`\n--- Accept #${i + 1}: skipped (no email) ---`)
      continue
    }

    console.log(`\n--- Accept #${i + 1}: ${email} ---`)
    const consumerId = await findUserIdByEmail(email)
    if (!consumerId) {
      console.log(`  SKIP: no auth user for ${email} — create/seed consumer first`)
      continue
    }

    const { session, supabaseUrl } = await createE2eAuthSessionForEmail(email)
    const cookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

    const res = await apiJson('/api/invite/accept', cookie, {
      method: 'POST',
      json: { token: invite.invite_token },
    })

    console.log(`  POST /api/invite/accept → ${res.status}`)
    console.log(`  body: ${JSON.stringify(res.body)}`)

    snap = await firmSnapshot(admin, firm.id, stripe, firm.stripe_subscription_id)
    console.log(
      `  after: connected=${snap.connected} client_limit=${snap.firm?.client_limit} billing_floor=${snap.firm?.billing_floor} stripe_qty=${snap.stripeQty}`,
    )

    if (res.status === 402 && res.body.error === 'limit_raise_required') {
      console.log('\n✓ Expected gate on 3rd accept — limit_raise_required')
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

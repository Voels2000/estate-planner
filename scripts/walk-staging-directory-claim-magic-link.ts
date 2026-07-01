/**
 * Staging walk: magic-link session → POST /api/directory/claim → billing seed checks.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-directory-claim-magic-link.ts
 *
 * Resets fixture first. Validates API spine (magic-link auth + claim + billing seed).
 * UI "Email me a link" on /claim/[token] requires PR #208 on staging deploy.
 */

import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { ENVIRONMENTS } from './testEnv'
import {
  DIRECTORY_CLAIM_WALK_FIXTURES,
  WALK_LISTING_SOURCE,
  type DirectoryClaimWalkKind,
} from './directory-claim-walk-fixture'
import { resetDirectoryClaimWalkFixture } from './directory-claim-walk-reset'
import {
  buildSupabaseAuthCookieHeader,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

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

async function ensureClaimWalkUser(email: string, role: 'attorney' | 'advisor') {
  const admin = createAdminClient()
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role },
    })
    if (error || !created.user) {
      throw new Error(`createUser ${email}: ${error?.message ?? 'no user'}`)
    }
    userId = created.user.id
  } else {
    await admin
      .from('profiles')
      .update({ role, ...(role === 'attorney' ? { is_attorney: true } : {}) })
      .eq('id', userId)
  }
  return userId
}

async function createMagicLinkSession(email: string, role: 'attorney' | 'advisor') {
  await ensureClaimWalkUser(email, role)
  const admin = createAdminClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink ${email}: ${linkErr?.message ?? 'no token'}`)
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) {
    throw new Error(`verifyOtp ${email}: ${error?.message ?? 'no session'}`)
  }
  return { session: data.session, supabaseUrl }
}

function pass(label: string, detail: string) {
  console.log(`  PASS ${label}: ${detail}`)
}

function fail(label: string, detail: string): never {
  console.error(`  FAIL ${label}: ${detail}`)
  process.exit(1)
}

async function walkKind(
  admin: ReturnType<typeof createAdminClient>,
  kind: DirectoryClaimWalkKind,
) {
  const fixture = DIRECTORY_CLAIM_WALK_FIXTURES[kind]
  const table = kind === 'attorney' ? 'attorney_listings' : 'advisor_directory'
  const role = kind === 'attorney' ? 'attorney' : 'advisor'

  const { data: listing } = await admin
    .from(table)
    .select(
      kind === 'attorney'
        ? 'id, claim_token, profile_id, claimed_at, email, client_limit, billing_floor, reset_count'
        : 'id, claim_token, profile_id, claimed_at, email',
    )
    .eq('source', WALK_LISTING_SOURCE)
    .eq('email', fixture.email)
    .maybeSingle()

  if (!listing?.claim_token) {
    fail(`${kind}-fixture`, `missing listing for ${fixture.email}`)
  }
  if (listing.profile_id) {
    fail(`${kind}-fixture`, 'listing already claimed — run reset first')
  }

  console.log(`\n=== ${kind} magic-link claim ===`)
  console.log(`  claim URL: ${BASE_URL}/claim/${listing.claim_token}`)

  const { session, supabaseUrl } = await createMagicLinkSession(fixture.email, role)
  const cookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)

  const userId = await findUserIdByEmail(fixture.email)
  if (!userId) fail(`${kind}-auth`, 'user not created after magic link')

  const { data: profileBefore } = await admin
    .from('profiles')
    .select('role, is_attorney, firm_id')
    .eq('id', userId)
    .single()

  if (profileBefore?.role !== role) {
    fail(`${kind}-role`, `expected role=${role}, got ${profileBefore?.role ?? 'null'}`)
  }
  pass(`${kind}-role`, profileBefore.role)

  const claimPage = await fetch(`${BASE_URL}/claim/${listing.claim_token}`, {
    headers: { Cookie: cookie },
  })
  pass(`${kind}-claim-page`, `GET /claim → ${claimPage.status}`)

  const claimRes = await apiJson('/api/directory/claim', cookie, {
    method: 'POST',
    json: {
      claimToken: listing.claim_token,
      firm_name: fixture.firm_name,
      contact_name: fixture.contact_name,
      website: fixture.website,
    },
  })

  if (claimRes.status !== 200 || !claimRes.body.success) {
    fail(`${kind}-claim-api`, `HTTP ${claimRes.status} ${JSON.stringify(claimRes.body)}`)
  }
  pass(`${kind}-claim-api`, `identity=${String(claimRes.body.identityMethod ?? '—')}`)

  const { data: listingAfter } = await admin
    .from(table)
    .select(
      kind === 'attorney'
        ? 'profile_id, claimed_at, client_limit, billing_floor, reset_count'
        : 'profile_id, claimed_at',
    )
    .eq('id', listing.id)
    .single()

  if (listingAfter?.profile_id !== userId || !listingAfter.claimed_at) {
    fail(`${kind}-listing-bind`, JSON.stringify(listingAfter))
  }
  pass(`${kind}-listing-bind`, `profile_id=${userId.slice(0, 8)}… claimed_at set`)

  if (kind === 'attorney') {
    if (
      listingAfter.client_limit !== 1 ||
      listingAfter.billing_floor !== 0 ||
      listingAfter.reset_count !== 0
    ) {
      fail(
        `${kind}-billing-seed`,
        `client_limit=${listingAfter.client_limit} billing_floor=${listingAfter.billing_floor} reset_count=${listingAfter.reset_count}`,
      )
    }
    pass(`${kind}-billing-seed`, 'client_limit=1 billing_floor=0 reset_count=0')

    const { data: profileAfter } = await admin
      .from('profiles')
      .select('is_attorney')
      .eq('id', userId)
      .single()
    if (!profileAfter?.is_attorney) {
      fail(`${kind}-is-attorney`, 'is_attorney not set')
    }
    pass(`${kind}-is-attorney`, 'true')
  } else {
    const { data: profileAfter } = await admin
      .from('profiles')
      .select('firm_id, firm_role')
      .eq('id', userId)
      .single()

    if (!profileAfter?.firm_id || profileAfter.firm_role !== 'owner') {
      fail(`${kind}-firm-bootstrap`, JSON.stringify(profileAfter))
    }

    const { data: firm } = await admin
      .from('firms')
      .select('client_limit, billing_floor, reset_count, owner_id')
      .eq('id', profileAfter.firm_id)
      .single()

    if (
      !firm ||
      firm.owner_id !== userId ||
      firm.client_limit !== 1 ||
      firm.billing_floor !== 0 ||
      firm.reset_count !== 0
    ) {
      fail(`${kind}-billing-seed`, JSON.stringify(firm))
    }
    pass(`${kind}-firm-bootstrap`, `firm_id=${profileAfter.firm_id.slice(0, 8)}…`)
    pass(`${kind}-billing-seed`, 'client_limit=1 billing_floor=0 reset_count=0')
  }
}

async function main() {
  initSupabaseEnv()
  console.log(`\nDirectory claim magic-link walk → ${BASE_URL}`)
  console.log('Resetting fixture…')
  await resetDirectoryClaimWalkFixture()

  const admin = createAdminClient()
  await walkKind(admin, 'attorney')
  await walkKind(admin, 'advisor')

  console.log('\n=== ALL PASS ===\n')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})

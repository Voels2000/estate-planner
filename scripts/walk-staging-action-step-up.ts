/**
 * Staging walk: action-gated step-up + credential at first client connect.
 *
 * Requires on Vercel staging:
 *   ACTION_GATED_PRIVILEGED_MFA=true
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-action-step-up.ts
 *
 * Resets directory claim walk attorney fixture, claims via magic link, seeds a
 * consumer_requested row, verifies step-up blocks accept, completes step-up
 * (password + TOTP), then verifies credential gate + accept with bar number.
 */

import { createClient, type Session } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { createAdminClient } from '../lib/supabase/admin'
import { ensureAttorneyClientRequestRow } from '../lib/attorney/createAttorneyClientRequest'
import { ENVIRONMENTS } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  DIRECTORY_CLAIM_WALK_FIXTURES,
  WALK_LISTING_SOURCE,
} from './directory-claim-walk-fixture'
import { resetDirectoryClaimWalkFixture } from './directory-claim-walk-reset'
import {
  buildSupabaseAuthCookieHeader,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'

const BASE_URL = ENVIRONMENTS.staging.baseURL
const ATTORNEY = DIRECTORY_CLAIM_WALK_FIXTURES.attorney
const WALK_PASSWORD = 'WalkStepUp!2026Mwm'
const WALK_BAR_NUMBER = 'E2E-WALK-12345'

function pass(label: string, detail: string) {
  console.log(`  PASS ${label}: ${detail}`)
}

function fail(label: string, detail: string): never {
  console.error(`  FAIL ${label}: ${detail}`)
  process.exit(1)
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
    parsed = { raw: text.slice(0, 400) }
  }
  return { status: res.status, body: parsed }
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

function generateTotpCode(secret: string, step = 30, digits = 6): string {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / step)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(code % 10 ** digits).padStart(digits, '0')
}

async function ensureClaimWalkUser(email: string) {
  const admin = createAdminClient()
  let userId = await findUserIdByEmail(email)
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: 'attorney' },
    })
    if (error || !created.user) {
      throw new Error(`createUser ${email}: ${error?.message ?? 'no user'}`)
    }
    userId = created.user.id
  }
  await admin
    .from('profiles')
    .update({ role: 'attorney', is_attorney: true })
    .eq('id', userId)
  return userId
}

async function createMagicLinkSession(email: string) {
  await ensureClaimWalkUser(email)
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

async function clearStepUpState(userId: string) {
  const admin = createAdminClient()

  const { data: factorData } = await admin.auth.admin.mfa.listFactors({ userId })
  for (const factor of factorData?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId })
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  const metadata = { ...(userData.user?.user_metadata ?? {}) }
  delete metadata.security_step_up_at

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  })
}

async function completeSecurityStepUp(session: Session) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (sessionError) throw new Error(`setSession: ${sessionError.message}`)

  const { error: passwordError } = await supabase.auth.updateUser({ password: WALK_PASSWORD })
  if (passwordError) throw new Error(`updateUser password: ${passwordError.message}`)

  const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'My Wealth Maps Walk',
  })
  if (enrollError || !enrollData) {
    throw new Error(`mfa.enroll: ${enrollError?.message ?? 'no data'}`)
  }

  const code = generateTotpCode(enrollData.totp.secret)
  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: enrollData.id,
    code,
  })
  if (verifyError) throw new Error(`mfa.challengeAndVerify: ${verifyError.message}`)

  const { error: metaError } = await supabase.auth.updateUser({
    data: { security_step_up_at: new Date().toISOString() },
  })
  if (metaError) throw new Error(`updateUser metadata: ${metaError.message}`)
}

async function claimAttorneyFixture(
  admin: ReturnType<typeof createAdminClient>,
  cookie: string,
  claimToken: string,
) {
  const claimRes = await apiJson('/api/directory/claim', cookie, {
    method: 'POST',
    json: {
      claimToken,
      firm_name: ATTORNEY.firm_name,
      contact_name: ATTORNEY.contact_name,
      website: ATTORNEY.website,
    },
  })
  if (claimRes.status !== 200 || !claimRes.body.success) {
    fail('claim-api', `HTTP ${claimRes.status} ${JSON.stringify(claimRes.body)}`)
  }
  pass('claim-api', 'directory claim succeeded')

  const { data: listing } = await admin
    .from('attorney_listings')
    .select('id, profile_id, credential_verified_at')
    .eq('source', WALK_LISTING_SOURCE)
    .eq('email', ATTORNEY.email)
    .single()

  if (!listing?.profile_id) fail('claim-listing', 'profile_id not set after claim')
  return listing
}

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()

  console.log('\n=== Staging walk: action step-up + credential at connect ===\n')
  console.log(`  base URL: ${BASE_URL}`)
  console.log('  requires ACTION_GATED_PRIVILEGED_MFA=true on staging deploy\n')

  await resetDirectoryClaimWalkFixture()

  const { data: seedListing } = await admin
    .from('attorney_listings')
    .select('id, claim_token')
    .eq('source', WALK_LISTING_SOURCE)
    .eq('email', ATTORNEY.email)
    .single()

  if (!seedListing?.claim_token) fail('fixture', 'missing attorney claim token after reset')

  const { session, supabaseUrl } = await createMagicLinkSession(ATTORNEY.email)
  const cookie = buildSupabaseAuthCookieHeader(supabaseUrl, session)
  const userId = await findUserIdByEmail(ATTORNEY.email)
  if (!userId) fail('auth', 'walk attorney user missing')

  const listing = await claimAttorneyFixture(admin, cookie, seedListing.claim_token)

  await admin
    .from('attorney_listings')
    .update({
      credential_verified_at: null,
      bar_number: null,
    })
    .eq('id', listing.id)

  const consumerId = await findUserIdByEmail(E2E_IDENTITIES.consumerTier1.email)
  if (!consumerId) fail('consumer', `missing ${E2E_IDENTITIES.consumerTier1.email}`)

  const requestRow = await ensureAttorneyClientRequestRow(admin, {
    attorneyListingId: listing.id,
    consumerUserId: consumerId,
    requestMessage: 'Action step-up walk fixture',
  })
  if (!requestRow.rowId) fail('consumer-request', 'could not seed consumer_requested row')

  await clearStepUpState(userId)

  const blocked = await apiJson('/api/attorney/accept-request', cookie, {
    method: 'POST',
    json: { attorney_client_id: requestRow.rowId },
  })

  if (blocked.body.step_up_required === true) {
    pass('step-up-block-api', `HTTP ${blocked.status} step_up_required`)
  } else if (process.env.ACTION_GATED_PRIVILEGED_MFA === 'true') {
    fail(
      'step-up-block-api',
      `expected step_up_required, got ${blocked.status} ${JSON.stringify(blocked.body)}`,
    )
  } else {
    console.log(
      '  WARN step-up-block-api: ACTION_GATED_PRIVILEGED_MFA not set locally — relying on staging deploy flag',
    )
    if (blocked.status !== 403 || blocked.body.step_up_required !== true) {
      fail(
        'step-up-flag',
        'Staging deploy must have ACTION_GATED_PRIVILEGED_MFA=true (accept did not return step_up_required)',
      )
    }
    pass('step-up-block-api', `HTTP ${blocked.status} step_up_required (staging flag on)`)
  }

  const pageRes = await fetch(`${BASE_URL}/attorney/requests`, {
    redirect: 'manual',
    headers: { Cookie: cookie },
  })
  if (pageRes.status >= 300 && pageRes.status < 400) {
    const location = pageRes.headers.get('location') ?? ''
    if (location.includes('/security-step-up')) {
      pass('step-up-block-page', `redirect → ${location}`)
    } else {
      fail('step-up-block-page', `unexpected redirect ${location}`)
    }
  } else {
    fail('step-up-block-page', `expected redirect, got HTTP ${pageRes.status}`)
  }

  await completeSecurityStepUp(session)

  const { session: steppedSession, supabaseUrl: steppedUrl } =
    await createMagicLinkSession(ATTORNEY.email)
  const steppedCookie = buildSupabaseAuthCookieHeader(steppedUrl, steppedSession)

  const credentialBlocked = await apiJson('/api/attorney/accept-request', steppedCookie, {
    method: 'POST',
    json: { attorney_client_id: requestRow.rowId },
  })
  if (
    credentialBlocked.status !== 403 ||
    credentialBlocked.body.credential_required !== true
  ) {
    fail(
      'credential-block',
      `expected credential_required, got ${credentialBlocked.status} ${JSON.stringify(credentialBlocked.body)}`,
    )
  }
  pass('credential-block', 'credential_required before bar number supplied')

  const accepted = await apiJson('/api/attorney/accept-request', steppedCookie, {
    method: 'POST',
    json: {
      attorney_client_id: requestRow.rowId,
      bar_number: WALK_BAR_NUMBER,
      bar_state: 'WA',
    },
  })
  if (accepted.status !== 200 || !accepted.body.success) {
    fail('accept-with-credential', `HTTP ${accepted.status} ${JSON.stringify(accepted.body)}`)
  }
  pass('accept-with-credential', 'connection accepted after bar number')

  const { data: listingAfter } = await admin
    .from('attorney_listings')
    .select('bar_number, credential_verified_at')
    .eq('id', listing.id)
    .single()

  if (!listingAfter?.credential_verified_at || listingAfter.bar_number !== WALK_BAR_NUMBER) {
    fail(
      'credential-verified',
      `expected bar=${WALK_BAR_NUMBER} + timestamp, got ${JSON.stringify(listingAfter)}`,
    )
  }
  pass('credential-verified', `credential_verified_at=${listingAfter.credential_verified_at}`)

  console.log('\n=== ALL PASS — action step-up + credential at connect ===\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

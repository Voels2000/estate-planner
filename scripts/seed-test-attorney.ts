/**
 * Creates a test attorney listing with a known profile on the target Supabase project.
 * referral_code is set by DB trigger on insert when present; otherwise backfilled here.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-test-attorney.ts
 *
 * Or with .env.test:
 *   dotenv -e .env.test -- npx tsx scripts/seed-test-attorney.ts
 */

// Test attorney portal account
// Email: test-attorney-portal@rolobe.resend.app
// Password: TestAttorney123!
// profile_id is set on attorney_listings so the newsletter kit renders in /attorney

import { createAdminClient } from '../lib/supabase/admin'

const TEST_ATTORNEY_LISTING_EMAIL = 'test-attorney@mywealthmaps.test'
const TEST_ATTORNEY_PORTAL_EMAIL = 'test-attorney-portal@rolobe.resend.app'
const TEST_ATTORNEY_PORTAL_PASSWORD = 'TestAttorney123!'
const KNOWN_REFERRAL_CODE = '6fd027d3'

type ListingRow = {
  id: string
  contact_name: string | null
  referral_code: string | null
  profile_id: string | null
  email: string | null
}

function initEnv() {
  if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
  }
}

async function ensureReferralCode(listingId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: row, error } = await supabase
    .from('attorney_listings')
    .select('referral_code')
    .eq('id', listingId)
    .single()

  if (error || !row) {
    console.error('Failed to load referral_code:', error?.message ?? 'not found')
    return null
  }

  if (row.referral_code) return row.referral_code

  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toLowerCase()
  const { error: updateError } = await supabase
    .from('attorney_listings')
    .update({ referral_code: code })
    .eq('id', listingId)

  if (updateError) {
    console.error('Failed to backfill referral_code:', updateError.message)
    return null
  }

  return code
}

function printReferralUsage(referralCode: string) {
  console.log('')
  console.log('Use this referral_code in smoke test section B and D:')
  console.log(`  /event/selling-a-business?aref=${referralCode}`)
}

async function findListing(supabase: ReturnType<typeof createAdminClient>): Promise<ListingRow | null> {
  const { data: byCode } = await supabase
    .from('attorney_listings')
    .select('id, contact_name, referral_code, profile_id, email')
    .eq('referral_code', KNOWN_REFERRAL_CODE)
    .maybeSingle()

  if (byCode) return byCode

  const { data: byEmail } = await supabase
    .from('attorney_listings')
    .select('id, contact_name, referral_code, profile_id, email')
    .eq('email', TEST_ATTORNEY_LISTING_EMAIL)
    .maybeSingle()

  return byEmail ?? null
}

async function ensureListing(supabase: ReturnType<typeof createAdminClient>): Promise<ListingRow> {
  const existing = await findListing(supabase)

  if (existing) {
    const code = existing.referral_code ?? (await ensureReferralCode(existing.id))
    console.log('Test attorney listing already exists:')
    console.log(`  id: ${existing.id}`)
    console.log(`  email: ${existing.email ?? TEST_ATTORNEY_LISTING_EMAIL}`)
    console.log(`  referral_code: ${code ?? '(missing)'}`)
  } else {
    const { data, error } = await supabase
      .from('attorney_listings')
      .insert({
        contact_name: 'Test Attorney',
        firm_name: 'MWM Test Law Group',
        email: TEST_ATTORNEY_LISTING_EMAIL,
        city: 'Minneapolis',
        state: 'MN',
        bar_number: 'TEST-001',
        bio: 'Test attorney listing for smoke testing. Do not use in production.',
        fee_structure: 'hourly',
        specializations: ['estate-planning', 'trusts'],
        states_licensed: ['MN', 'WI'],
        serves_remote: true,
        is_verified: true,
        is_active: true,
      })
      .select('id, contact_name, referral_code, profile_id, email')
      .single()

    if (error || !data) {
      console.error('Failed to create test attorney listing:', error?.message ?? 'unknown error')
      process.exit(1)
    }

    const code = data.referral_code ?? (await ensureReferralCode(data.id))
    console.log('Test attorney listing created:')
    console.log(`  id: ${data.id}`)
    console.log(`  contact_name: ${data.contact_name}`)
    console.log(`  referral_code: ${code ?? '(missing)'}`)

    return { ...data, referral_code: code ?? data.referral_code }
  }

  const code = existing.referral_code ?? (await ensureReferralCode(existing.id))
  return { ...existing, referral_code: code ?? existing.referral_code }
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (profile?.id) return profile.id

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (authError) {
    console.error('auth.admin.listUsers failed:', authError.message)
    return null
  }

  const match = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  return match?.id ?? null
}

async function ensureAttorneyAuthUser(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const existingId = await findAuthUserByEmail(supabase, TEST_ATTORNEY_PORTAL_EMAIL)

  if (existingId) {
    console.log('Test attorney portal auth user already exists:')
    console.log(`  email: ${TEST_ATTORNEY_PORTAL_EMAIL}`)
    console.log(`  user_id: ${existingId}`)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', existingId)
      .maybeSingle()

    if (profile && profile.role !== 'attorney') {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'attorney', full_name: 'Test Attorney Portal' })
        .eq('id', existingId)
        .neq('role', 'attorney')

      if (roleError) {
        console.warn('Could not set attorney role on profile:', roleError.message)
      } else {
        console.log('  role: updated to attorney')
      }
    }

    return existingId
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: TEST_ATTORNEY_PORTAL_EMAIL,
    password: TEST_ATTORNEY_PORTAL_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Test Attorney Portal', role: 'attorney' },
  })

  if (createErr || !created.user) {
    const recoveredId = await findAuthUserByEmail(supabase, TEST_ATTORNEY_PORTAL_EMAIL)
    if (recoveredId) {
      console.log('Recovered existing auth user after create conflict:')
      console.log(`  email: ${TEST_ATTORNEY_PORTAL_EMAIL}`)
      console.log(`  user_id: ${recoveredId}`)
      return recoveredId
    }

    console.error('auth.admin.createUser failed:', createErr?.message ?? 'no user returned')
    process.exit(1)
  }

  console.log('Test attorney portal auth user created:')
  console.log(`  email: ${TEST_ATTORNEY_PORTAL_EMAIL}`)
  console.log(`  user_id: ${created.user.id}`)
  console.log(`  password: ${TEST_ATTORNEY_PORTAL_PASSWORD}`)

  return created.user.id
}

async function linkListingProfileId(
  supabase: ReturnType<typeof createAdminClient>,
  listing: ListingRow,
  userId: string,
): Promise<void> {
  if (listing.profile_id === userId) {
    console.log('profile_id already linked to portal user — no change needed')
    console.log(`  listing_id: ${listing.id}`)
    console.log(`  profile_id: ${userId}`)
    return
  }

  if (listing.profile_id && listing.profile_id !== userId) {
    console.warn('profile_id already set to a different user — not overwriting')
    console.warn(`  listing_id: ${listing.id}`)
    console.warn(`  existing profile_id: ${listing.profile_id}`)
    console.warn(`  portal user_id: ${userId}`)
    return
  }

  const { error: updateError } = await supabase
    .from('attorney_listings')
    .update({ profile_id: userId })
    .eq('id', listing.id)
    .is('profile_id', null)

  if (updateError) {
    console.error('Failed to set profile_id on attorney_listings:', updateError.message)
    process.exit(1)
  }

  const { data: verified } = await supabase
    .from('attorney_listings')
    .select('profile_id')
    .eq('id', listing.id)
    .single()

  if (verified?.profile_id !== userId) {
    console.error('profile_id update did not persist — listing may have been claimed concurrently')
    process.exit(1)
  }

  console.log('Linked attorney_listings.profile_id to portal user:')
  console.log(`  listing_id: ${listing.id}`)
  console.log(`  profile_id: ${userId}`)
}

async function seedTestAttorney() {
  initEnv()
  const supabase = createAdminClient()

  const listing = await ensureListing(supabase)
  const userId = await ensureAttorneyAuthUser(supabase)
  await linkListingProfileId(supabase, listing, userId)

  const referralCode = listing.referral_code ?? (await ensureReferralCode(listing.id))
  if (referralCode) printReferralUsage(referralCode)

  console.log('')
  console.log('Portal login: /login → /attorney')
  console.log(`  email: ${TEST_ATTORNEY_PORTAL_EMAIL}`)
  console.log(`  password: ${TEST_ATTORNEY_PORTAL_PASSWORD}`)
}

seedTestAttorney().catch((err) => {
  console.error(err)
  process.exit(1)
})

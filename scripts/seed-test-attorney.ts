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

import { createAdminClient } from '../lib/supabase/admin'

const TEST_ATTORNEY_EMAIL = 'test-attorney@mywealthmaps.test'

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

async function seedTestAttorney() {
  initEnv()
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('attorney_listings')
    .select('id, contact_name, referral_code')
    .eq('email', TEST_ATTORNEY_EMAIL)
    .maybeSingle()

  if (existing) {
    const code = existing.referral_code ?? (await ensureReferralCode(existing.id))
    console.log('Test attorney already exists:')
    console.log(`  id: ${existing.id}`)
    console.log(`  referral_code: ${code ?? '(missing)'}`)
    if (code) printReferralUsage(code)
    return
  }

  const { data, error } = await supabase
    .from('attorney_listings')
    .insert({
      contact_name: 'Test Attorney',
      firm_name: 'MWM Test Law Group',
      email: TEST_ATTORNEY_EMAIL,
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
    .select('id, contact_name, referral_code')
    .single()

  if (error) {
    console.error('Failed to create test attorney:', error.message)
    process.exit(1)
  }

  const referralCode = data.referral_code ?? (await ensureReferralCode(data.id))

  console.log('Test attorney created:')
  console.log(`  id: ${data.id}`)
  console.log(`  contact_name: ${data.contact_name}`)
  console.log(`  referral_code: ${referralCode ?? '(missing)'}`)
  if (referralCode) printReferralUsage(referralCode)
}

seedTestAttorney().catch((err) => {
  console.error(err)
  process.exit(1)
})

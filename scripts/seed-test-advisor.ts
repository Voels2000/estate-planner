/**
 * Creates a test advisor listing on the target Supabase project.
 * referral_code is set by DB trigger on insert when present; otherwise backfilled here.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/seed-test-advisor.ts
 *
 * Or:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-test-advisor.ts
 */

import { createAdminClient } from '../lib/supabase/admin'

const TEST_ADVISOR_EMAIL = 'test-advisor@mywealthmaps.test'

function initEnv() {
  if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
  }
}

async function ensureReferralCode(listingId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: row, error } = await supabase
    .from('advisor_directory')
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
    .from('advisor_directory')
    .update({ referral_code: code })
    .eq('id', listingId)

  if (updateError) {
    console.error('Failed to backfill referral_code:', updateError.message)
    return null
  }

  console.log('Note: referral_code backfilled by script (trigger not present at insert time)')
  return code
}

function printSmokeTestUrl(referralCode: string) {
  console.log('')
  console.log('Use this referral_code in smoke test sections A and C:')
  console.log(`  /event/selling-a-business?ref=${referralCode}`)
}

async function seedTestAdvisor() {
  initEnv()
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('advisor_directory')
    .select('id, contact_name, referral_code')
    .eq('email', TEST_ADVISOR_EMAIL)
    .maybeSingle()

  if (existing) {
    const code = existing.referral_code ?? (await ensureReferralCode(existing.id))
    console.log('Test advisor already exists:')
    console.log(`  id: ${existing.id}`)
    console.log(`  contact_name: ${existing.contact_name}`)
    console.log(`  referral_code: ${code ?? '(missing)'}`)
    if (code) printSmokeTestUrl(code)
    return
  }

  const { data, error } = await supabase
    .from('advisor_directory')
    .insert({
      contact_name: 'Test Advisor',
      firm_name: 'MWM Test Advisory Group',
      email: TEST_ADVISOR_EMAIL,
      city: 'Minneapolis',
      state: 'MN',
      bio: 'Test advisor listing for smoke testing. Do not use in production.',
      credentials: ['CFP'],
      specializations: ['estate-planning', 'retirement'],
      is_verified: true,
      is_active: true,
    })
    .select('id, contact_name, referral_code')
    .single()

  if (error) {
    console.error('Failed to create test advisor:', error.message)
    process.exit(1)
  }

  const referralCode = data.referral_code ?? (await ensureReferralCode(data.id))

  console.log('Test advisor created:')
  console.log(`  id: ${data.id}`)
  console.log(`  contact_name: ${data.contact_name}`)
  console.log(`  referral_code: ${referralCode ?? '(missing)'}`)
  if (referralCode) printSmokeTestUrl(referralCode)
}

seedTestAdvisor().catch((err) => {
  console.error(err)
  process.exit(1)
})

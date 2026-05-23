/**
 * Ensures the Playwright consumer test account is on estate tier (tier 3).
 * Does not create a user — uses PLAYWRIGHT_CONSUMER_EMAIL from the environment.
 * Safe to re-run (idempotent).
 *
 * Usage:
 *   PLAYWRIGHT_CONSUMER_EMAIL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/seed-test-consumer-estate.ts
 *
 * Or with .env.test:
 *   dotenv -e .env.test -- npx tsx scripts/seed-test-consumer-estate.ts
 */

import { createAdminClient } from '../lib/supabase/admin'

function initEnv() {
  if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
  }
}

async function seedConsumerEstateTier() {
  initEnv()

  const playwrightEmail = process.env.PLAYWRIGHT_CONSUMER_EMAIL?.trim()
  if (!playwrightEmail) {
    console.error('PLAYWRIGHT_CONSUMER_EMAIL not set')
    process.exit(1)
  }

  const supabase = createAdminClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, consumer_tier, subscription_status')
    .eq('email', playwrightEmail)
    .maybeSingle()

  if (error || !profile) {
    console.error('Consumer profile not found:', playwrightEmail)
    if (error) console.error(error.message)
    process.exit(1)
  }

  console.log('Current state:')
  console.log(`  email: ${profile.email}`)
  console.log(`  consumer_tier: ${profile.consumer_tier}`)
  console.log(`  subscription_status: ${profile.subscription_status}`)

  if (profile.consumer_tier === 3) {
    console.log('Already on estate tier — no change needed.')
    return
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      consumer_tier: 3,
      subscription_status: 'active',
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error('Failed to update tier:', updateError.message)
    process.exit(1)
  }

  console.log('Updated to estate tier (tier 3).')
}

seedConsumerEstateTier().catch((err) => {
  console.error(err)
  process.exit(1)
})

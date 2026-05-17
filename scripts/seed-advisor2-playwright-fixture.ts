/**
 * Ensures Playwright advisor2 account has Michael Johnson (or Johnson-named client)
 * and an active link to household 90cc8759 for strategy-recommendation API tests.
 *
 * Usage:
 *   SEED_ADVISOR_EMAIL=advisor2@rolobe.resend.app npx tsx scripts/seed-michael-johnson-advisor-demo.ts
 *   npx tsx scripts/seed-advisor2-playwright-fixture.ts
 */

import { createAdminClient } from '../lib/supabase/admin'

const ADVISOR2_EMAIL = process.env.SEED_ADVISOR_EMAIL?.trim() ?? 'advisor2@rolobe.resend.app'
const STRATEGY_TEST_HOUSEHOLD_ID = '90cc8759-5465-4671-8894-e17eca783a42'

async function main() {
  const admin = createAdminClient()

  const { data: advisor } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('email', ADVISOR2_EMAIL)
    .maybeSingle()

  if (!advisor?.id) {
    console.error('Advisor not found:', ADVISOR2_EMAIL)
    process.exit(1)
  }

  console.log('Advisor:', advisor.email, advisor.id)

  const { data: household } = await admin
    .from('households')
    .select('id, owner_id')
    .eq('id', STRATEGY_TEST_HOUSEHOLD_ID)
    .maybeSingle()

  if (household?.owner_id) {
    const { data: existingLink } = await admin
      .from('advisor_clients')
      .select('id, status')
      .eq('advisor_id', advisor.id)
      .eq('client_id', household.owner_id)
      .maybeSingle()

    if (!existingLink) {
      const { error } = await admin.from('advisor_clients').insert({
        advisor_id: advisor.id,
        client_id: household.owner_id,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      if (error) console.error('advisor_clients insert:', error.message)
      else console.log('Linked advisor2 to strategy test household owner')
    } else if (existingLink.status !== 'active') {
      await admin
        .from('advisor_clients')
        .update({ status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', existingLink.id)
      console.log('Reactivated advisor_clients link')
    } else {
      console.log('Strategy test household link already active')
    }
  } else {
    console.warn('Household not found:', STRATEGY_TEST_HOUSEHOLD_ID)
  }

  console.log('\nRun Michael Johnson demo seed for advisor2:')
  console.log(`  SEED_ADVISOR_EMAIL=${ADVISOR2_EMAIL} npx tsx scripts/seed-michael-johnson-advisor-demo.ts`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

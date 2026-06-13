/**
 * Removes Playwright-created rows from the canonical E2E consumer household
 * without deleting users. Safe to re-run before a full E2E pass.
 *
 * Usage:
 *   dotenv -e .env.local -e .env.test -- npx tsx scripts/prune-e2e-household-artifacts.ts
 */

import { createAdminClient } from '../lib/supabase/admin'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv, pruneStrayE2eAdvisorClientLinks } from './seed-e2e-lib'

const PLAYWRIGHT_NAME_PREFIXES = [
  'Playwright',
  'Smoke Test',
  'E2E Brokerage',
  'E2E Traditional',
]

const PLAYWRIGHT_SCENARIO_NAMES = [
  'Playwright Test Plan',
  'Playwright Upsert Test',
  'Playwright Scenario A',
  'Playwright Scenario B',
  'Playwright Keep',
  'Playwright Remove',
  'Playwright Roth Test',
  'Playwright Liquidity Test',
  'Playwright Family',
  'Playwright Titling',
]

async function main() {
  const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim()
  const consumerEmail =
    process.env.PLAYWRIGHT_CONSUMER_EMAIL?.trim() ?? E2E_IDENTITIES.consumer.email

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', consumerEmail)
    .maybeSingle()

  if (!profile?.id) {
    console.error('Consumer profile not found:', consumerEmail)
    process.exit(1)
  }

  let hhId = householdId
  if (!hhId) {
    const { data: hh } = await admin
      .from('households')
      .select('id')
      .eq('owner_id', profile.id)
      .maybeSingle()
    hhId = hh?.id
  }

  if (!hhId) {
    console.error('No household for', consumerEmail)
    process.exit(1)
  }

  console.log('Pruning Playwright artifacts for', consumerEmail, 'household', hhId)

  for (const prefix of PLAYWRIGHT_NAME_PREFIXES) {
    const { count, error } = await admin
      .from('assets')
      .delete({ count: 'exact' })
      .eq('owner_id', profile.id)
      .ilike('name', `${prefix}%`)
    if (error) console.warn('assets:', error.message)
    else if (count) console.log(`  assets deleted (${prefix}*):`, count)
  }

  const { count: peopleCount, error: peopleErr } = await admin
    .from('household_people')
    .delete({ count: 'exact' })
    .eq('household_id', hhId)
    .ilike('full_name', 'Playwright%')
  if (peopleErr) console.warn('household_people:', peopleErr.message)
  else if (peopleCount) console.log('  household_people deleted:', peopleCount)

  for (const scenarioName of PLAYWRIGHT_SCENARIO_NAMES) {
    const { count, error } = await admin
      .from('strategy_line_items')
      .delete({ count: 'exact' })
      .eq('household_id', hhId)
      .eq('scenario_name', scenarioName)
    if (error) console.warn('strategy_line_items:', scenarioName, error.message)
    else if (count) console.log(`  strategy_line_items "${scenarioName}":`, count)
  }

  const { count: dafCount } = await admin
    .from('strategy_line_items')
    .delete({ count: 'exact' })
    .eq('household_id', hhId)
    .in('strategy_source', ['daf', 'charitable'])
    .eq('scenario_name', 'base')
  if (dafCount) console.log('  strategy_line_items daf/charitable base:', dafCount)

  initSupabaseEnv()
  const advisorId = await findUserIdByEmail(E2E_IDENTITIES.advisor.email)
  const advisorClientId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
  if (advisorId && advisorClientId) {
    await pruneStrayE2eAdvisorClientLinks(advisorId, advisorClientId)
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Master seed for Playwright E2E fixtures (go-live v2).
 *
 * Creates/resets canonical @mywealthmaps.test users, households, directory
 * listings, and prints a .env.test block to copy.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/seed-e2e-fixtures.ts
 *
 * Options:
 *   --write-example        Write docs/.env.test.example (no secrets except placeholders)
 *   --skip-advisor-client  Skip linked advisor client household (faster)
 *   --only=consumer,advisor,attorney,tier1,tier2,app-trial,plan-export,canceled,superuser
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  buildEnvTestFileLines,
  E2E_IDENTITIES,
  E2E_REFERRAL_CODES,
} from './e2e-test-identities'
import { ENVIRONMENTS, resolveTestEnv, type TestEnv } from './testEnv'
import {
  ensureAdvisorDirectoryListing,
  ensureAttorneyListingAndPortal,
  ensureAuthUser,
  ensureAdvisorFirmForE2e,
  ensureAdvisorEmptyForE2e,
  ensureE2eAppTrialConsumer,
  ensureE2eCanceledSubscriber,
  ensureE2ePlanExportPurchaser,
  ensureE2eSuperuser,
  initSupabaseEnv,
  seedE2eAdvisorClientHousehold,
  seedE2eConsumerHousehold,
  seedE2eConsumerEnrichments,
  seedE2eLowScoreHousehold,
  fetchHouseholdIdByOwnerId,
  verifyE2eAccounts,
} from './seed-e2e-lib'

function parseOnlyFlag(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith('--only='))
  if (!arg) return null
  return new Set(arg.replace('--only=', '').split(',').map((s) => s.trim()))
}

async function main() {
  initSupabaseEnv()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Need SUPABASE_SERVICE_ROLE_KEY (and URL) from .env.local')
    process.exit(1)
  }

  const only = parseOnlyFlag()
  const skipAdvisorClient = process.argv.includes('--skip-advisor-client')
  const writeExample = process.argv.includes('--write-example')
  const testEnv: TestEnv = (() => {
    try {
      return resolveTestEnv()
    } catch {
      return 'local'
    }
  })()
  const { baseURL: baseUrl, envFile } = ENVIRONMENTS[testEnv]

  const run = (name: string) => !only || only.has(name)

  console.log('=== E2E fixture seed (go-live v2) ===\n')

  let householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID ?? ''
  let consumerUserId = ''
  let tier1HouseholdId = ''
  let tier1UserId = ''
  let advisorId = ''
  let advisorEmptyId = ''
  let advisorClientUserId = ''
  let advisorClientHouseholdId = ''

  if (run('consumer')) {
    console.log('1. Consumer (estate tier 3)')
    consumerUserId = await ensureAuthUser({
      email: E2E_IDENTITIES.consumer.email,
      password: E2E_IDENTITIES.consumer.password,
      fullName: E2E_IDENTITIES.consumer.fullName,
      role: 'consumer',
    })
    householdId = await seedE2eConsumerHousehold(
      consumerUserId,
      E2E_IDENTITIES.consumer.householdName,
      3,
      { fullName: E2E_IDENTITIES.consumer.fullName },
    )
    console.log('')
  }

  if (run('tier1')) {
    console.log('2. Consumer tier-1 (upgrade gate tests)')
    tier1UserId = await ensureAuthUser({
      email: E2E_IDENTITIES.consumerTier1.email,
      password: E2E_IDENTITIES.consumerTier1.password,
      fullName: E2E_IDENTITIES.consumerTier1.fullName,
      role: 'consumer',
    })
    tier1HouseholdId = await seedE2eConsumerHousehold(
      tier1UserId,
      E2E_IDENTITIES.consumerTier1.householdName,
      1,
      { fullName: E2E_IDENTITIES.consumerTier1.fullName },
    )
    // Persona-matrix seeds tier1 without advisor — decouples low-score fixture from advisor enrichments (B4 playbook "Needs attention").
    await seedE2eLowScoreHousehold(tier1HouseholdId, 40)
    console.log('')
  }

  if (run('tier2')) {
    console.log('2a. Consumer tier-2 (retirement active)')
    const tier2UserId = await ensureAuthUser({
      email: E2E_IDENTITIES.consumerTier2.email,
      password: E2E_IDENTITIES.consumerTier2.password,
      fullName: E2E_IDENTITIES.consumerTier2.fullName,
      role: 'consumer',
    })
    await seedE2eConsumerHousehold(
      tier2UserId,
      E2E_IDENTITIES.consumerTier2.householdName,
      2,
      { fullName: E2E_IDENTITIES.consumerTier2.fullName },
    )
    console.log('')
  }

  if (run('app-trial')) {
    console.log('2b. Consumer app-managed trial (effective tier 3)')
    await ensureE2eAppTrialConsumer()
    console.log('')
  }

  if (run('plan-export')) {
    console.log('2c. Consumer Plan & Export purchaser (no active sub)')
    await ensureE2ePlanExportPurchaser()
    console.log('')
  }

  if (run('canceled')) {
    console.log('2d. Consumer canceled (subscribe→cancel → tier 0)')
    await ensureE2eCanceledSubscriber()
    console.log('')
  }

  if (run('advisor')) {
    console.log('3. Advisor portal + directory listing')
    advisorId = await ensureAuthUser({
      email: E2E_IDENTITIES.advisor.email,
      password: E2E_IDENTITIES.advisor.password,
      fullName: E2E_IDENTITIES.advisor.fullName,
      role: 'advisor',
    })
    const { createAdminClient } = await import('../lib/supabase/admin')
    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({
        subscription_status: 'active',
        consumer_tier: 3,
        is_superuser: false,
      })
      .eq('id', advisorId)
    await ensureAdvisorDirectoryListing()
    await ensureAdvisorFirmForE2e(advisorId, E2E_IDENTITIES.advisor.firmName)
    console.log('')
  }

  if (run('advisor') && !skipAdvisorClient && advisorId) {
    console.log('4. Advisor linked client (E2E advisor client household)')
    advisorClientUserId = await ensureAuthUser({
      email: E2E_IDENTITIES.advisorClient.email,
      password: E2E_IDENTITIES.advisorClient.password,
      fullName: E2E_IDENTITIES.advisorClient.fullName,
      role: 'consumer',
    })
    await seedE2eAdvisorClientHousehold(advisorClientUserId, advisorId)
    advisorClientHouseholdId = (await fetchHouseholdIdByOwnerId(advisorClientUserId)) ?? ''
    console.log('')
  }

  if (run('advisor')) {
    console.log('4b. Advisor empty (zero clients — playbook empty state)')
    advisorEmptyId = await ensureAdvisorEmptyForE2e()
    console.log('')
  }

  if (run('consumer') && householdId && consumerUserId && advisorId) {
    console.log('5. Consumer enrichments (projections, pending rec, drip, low-score tier1)')
    await seedE2eConsumerEnrichments({
      consumerUserId,
      consumerHouseholdId: householdId,
      tier1HouseholdId: tier1HouseholdId || undefined,
      primaryAdvisorId: advisorId || undefined,
      tier1UserId: tier1UserId || undefined,
      advisorClientUserId: advisorClientUserId || undefined,
    })
    console.log('')
  }

  if (run('attorney')) {
    console.log('6. Attorney listing + portal')
    await ensureAttorneyListingAndPortal()
    console.log('')
  }

  if (run('superuser')) {
    console.log('7. Staging superuser (preview gallery gate — auth + flag only)')
    await ensureE2eSuperuser()
    console.log('')
  }

  if (!householdId && run('consumer')) {
    console.error('Household id missing — consumer seed failed')
    process.exit(1)
  }

  console.log('8. Verify E2E account state')
  await verifyE2eAccounts()
  console.log('')

  const envBlock = buildEnvTestFileLines({
    testEnv,
    householdId,
    advisorClientHouseholdId: advisorClientHouseholdId || undefined,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  console.log(`=== Copy into ${envFile} ===\n`)
  console.log(envBlock)

  console.log('=== Referral smoke URLs ===')
  console.log(`  /event/selling-a-business?ref=${E2E_REFERRAL_CODES.advisor}`)
  console.log(`  /event/selling-a-business?aref=${E2E_REFERRAL_CODES.attorney}`)
  console.log('')
  console.log('=== Next steps ===')
  console.log('  npx tsx scripts/prune-e2e-household-artifacts.ts   # optional: clear Playwright test rows')
  console.log('  npm run test:e2e:complete -- --workers=1')
  console.log('')
  console.log('Go-live auth cleanup (keeps PROTECTED list — see E2E_TEST_RESET.md):')
  console.log('  npm run cleanup:purge:dry-run')
  console.log('  npm run cleanup:purge')

  if (writeExample) {
    const examplePath = join(process.cwd(), '.env.test.local.example')
    const sanitized = buildEnvTestFileLines({
      testEnv: 'local',
      householdId: '<run seed-e2e-fixtures.ts>',
    })
    writeFileSync(examplePath, sanitized, 'utf8')
    console.log(`Wrote ${examplePath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

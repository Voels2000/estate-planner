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
 *   --write-example   Write docs/.env.test.example (no secrets except placeholders)
 *   --skip-johnson    Skip Michael Johnson advisor client (faster)
 *   --only=consumer,advisor,attorney,tier1
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  buildEnvTestFileLines,
  E2E_IDENTITIES,
  E2E_REFERRAL_CODES,
} from './e2e-test-identities'
import {
  ensureAdvisorDirectoryListing,
  ensureAttorneyListingAndPortal,
  ensureAuthUser,
  initSupabaseEnv,
  linkAdvisorToClient,
  runMichaelJohnsonDemoSeed,
  seedE2eConsumerHousehold,
  findUserIdByEmail,
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
  const skipJohnson = process.argv.includes('--skip-johnson')
  const writeExample = process.argv.includes('--write-example')
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL ?? 'https://estate-planner-gules.vercel.app'

  const run = (name: string) => !only || only.has(name)

  console.log('=== E2E fixture seed (go-live v2) ===\n')

  let householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID ?? ''

  if (run('consumer')) {
    console.log('1. Consumer (estate tier 3)')
    const userId = await ensureAuthUser({
      email: E2E_IDENTITIES.consumer.email,
      password: E2E_IDENTITIES.consumer.password,
      fullName: E2E_IDENTITIES.consumer.fullName,
      role: 'consumer',
    })
    householdId = await seedE2eConsumerHousehold(
      userId,
      E2E_IDENTITIES.consumer.householdName,
      3,
    )
    console.log('')
  }

  if (run('tier1')) {
    console.log('2. Consumer tier-1 (upgrade gate tests)')
    const tier1Id = await ensureAuthUser({
      email: E2E_IDENTITIES.consumerTier1.email,
      password: E2E_IDENTITIES.consumerTier1.password,
      fullName: E2E_IDENTITIES.consumerTier1.fullName,
      role: 'consumer',
    })
    await seedE2eConsumerHousehold(
      tier1Id,
      E2E_IDENTITIES.consumerTier1.householdName,
      1,
    )
    console.log('')
  }

  let advisorId = ''
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
    console.log('')
  }

  if (run('advisor') && !skipJohnson) {
    console.log('4. Advisor client (Michael Johnson demo)')
    await runMichaelJohnsonDemoSeed(
      E2E_IDENTITIES.advisor.email,
      E2E_IDENTITIES.advisorClient.email,
    )
    if (advisorId) {
      const clientId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
      if (clientId) await linkAdvisorToClient(advisorId, clientId)
    }
    console.log('')
  }

  if (run('attorney')) {
    console.log('5. Attorney listing + portal')
    await ensureAttorneyListingAndPortal()
    console.log('')
  }

  if (!householdId && run('consumer')) {
    console.error('Household id missing — consumer seed failed')
    process.exit(1)
  }

  const envBlock = buildEnvTestFileLines({
    baseUrl,
    householdId,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  console.log('=== Copy into .env.test ===\n')
  console.log(envBlock)

  console.log('=== Referral smoke URLs ===')
  console.log(`  /event/selling-a-business?ref=${E2E_REFERRAL_CODES.advisor}`)
  console.log(`  /event/selling-a-business?aref=${E2E_REFERRAL_CODES.attorney}`)
  console.log('')
  console.log('=== Next steps ===')
  console.log('  npx tsx scripts/prune-e2e-household-artifacts.ts   # optional: clear Playwright test rows')
  console.log('  npm run test:e2e:complete -- --workers=1')
  console.log('')
  console.log('Legacy accounts (david@rolobe, advisor2@, etc.) can be removed after cutover:')
  console.log('  Review scripts/cleanup-test-accounts.ts PROTECTED list first.')

  if (writeExample) {
    const examplePath = join(process.cwd(), '.env.test.example')
    const sanitized = buildEnvTestFileLines({
      baseUrl: 'https://estate-planner-gules.vercel.app',
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

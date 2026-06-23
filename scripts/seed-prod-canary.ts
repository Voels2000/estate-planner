/**
 * Seed / reset the production consumer canary (Phase E — two-DB migration).
 *
 * Creates canary-consumer@mywealthmaps.com with fresh synthetic household data on
 * PRODUCTION Supabase only. Idempotent — safe to re-run to reset known state.
 *
 * Usage (you run this — never CI):
 *   E2E_CANARY_PASSWORD='…same as Vercel Production…' npm run seed:prod-canary -- --confirm
 *
 * Requires .env.projects.local with PROD_* Supabase vars.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { PROD_CANARY } from './e2e-test-identities'
import {
  ensureAuthUser,
  initSupabaseEnv,
  seedE2eConsumerHousehold,
} from './seed-e2e-lib'

const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

function getProjectsVar(name: string, contents: string): string {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return match?.[1]?.trim().replace(/\r$/, '') ?? ''
}

function loadProdSupabaseEnv(): void {
  const projectsFile = join(process.cwd(), '.env.projects.local')
  if (!existsSync(projectsFile)) {
    console.error('Missing .env.projects.local — copy .env.projects.example and fill PROD_* vars.')
    process.exit(1)
  }

  const contents = readFileSync(projectsFile, 'utf8')
  const mapping: Array<[string, string]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', 'PROD_NEXT_PUBLIC_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'PROD_SUPABASE_SERVICE_ROLE_KEY'],
    ['SUPABASE_DB_URL', 'PROD_SUPABASE_DB_URL'],
  ]

  for (const [target, source] of mapping) {
    const val = getProjectsVar(source, contents)
    if (!val) {
      console.error(`Missing ${source} in .env.projects.local`)
      process.exit(1)
    }
    process.env[target] = val
  }
}

function extractSupabaseProjectRef(url: string): string | null {
  try {
    const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function assertProdCanarySeedSafe(): void {
  const confirm = process.argv.includes('--confirm')
  const password = process.env.E2E_CANARY_PASSWORD?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = extractSupabaseProjectRef(url)

  console.log('\n========================================')
  console.log(`CANARY SEED TARGET: ${ref ?? '(unparsed)'} (${url})`)
  console.log(`CANARY EMAIL: ${PROD_CANARY.email}`)
  console.log('========================================\n')

  if (!confirm) {
    console.error('SAFETY: pass --confirm to seed the production canary.')
    console.error(
      "  E2E_CANARY_PASSWORD='…' npm run seed:prod-canary -- --confirm",
    )
    process.exit(1)
  }

  if (ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    console.error(
      `SAFETY: NEXT_PUBLIC_SUPABASE_URL must be production (ref ${PRODUCTION_SUPABASE_PROJECT_REF}), got ${ref ?? 'unknown'}.`,
    )
    process.exit(1)
  }

  if (!password || password.length < 12) {
    console.error('SAFETY: set E2E_CANARY_PASSWORD (≥12 chars, same as Vercel Production).')
    process.exit(1)
  }
}

async function main() {
  loadProdSupabaseEnv()
  assertProdCanarySeedSafe()
  initSupabaseEnv()

  console.log('=== Production consumer canary seed ===\n')

  const password = process.env.E2E_CANARY_PASSWORD!.trim()

  const userId = await ensureAuthUser({
    email: PROD_CANARY.email,
    password,
    fullName: PROD_CANARY.fullName,
    role: 'consumer',
  })

  const householdId = await seedE2eConsumerHousehold(
    userId,
    PROD_CANARY.householdName,
    3,
    { fullName: PROD_CANARY.fullName },
  )

  console.log('\n✅ Canary seeded on production.')
  console.log(`   user_id:      ${userId}`)
  console.log(`   household_id: ${householdId}`)
  console.log('\n=== Add to .env.test.production (prod smoke) ===\n')
  console.log(`PLAYWRIGHT_CONSUMER_EMAIL=${PROD_CANARY.email}`)
  console.log('PLAYWRIGHT_CONSUMER_PASSWORD=<E2E_CANARY_PASSWORD — do not commit>')
  console.log(`PLAYWRIGHT_HOUSEHOLD_ID=${householdId}`)
  console.log('\nVerify: log in at https://www.mywealthmaps.com/login with the canary email + password.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

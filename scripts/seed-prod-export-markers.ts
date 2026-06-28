/**
 * Pre-seed export isolation markers on production — run before read-only prod smoke.
 *
 * Plants marker rows in consumer + foreign (advisor-client) households so
 * cross-household-isolation can assert foreign-marker-absence without service role
 * during the smoke run.
 *
 * Usage (manual only — never CI):
 *   npm run seed:prod-export-markers -- --confirm
 *
 * Requires .env.projects.local with PROD_* Supabase vars (service role).
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { PROD_CANARY, PROD_ROLE_CANARIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'
import { seedExportIsolationMarkers } from '../tests/e2e/helpers/export-isolation-fixture'

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

function assertProdExportMarkerSeedSafe(): void {
  const confirm = process.argv.includes('--confirm')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = extractSupabaseProjectRef(url)

  console.log('\n========================================')
  console.log('PROD EXPORT ISOLATION MARKER SEED')
  console.log(`TARGET: ${ref ?? '(unparsed)'} (${url})`)
  console.log('========================================\n')

  if (!confirm) {
    console.error('SAFETY: pass --confirm to seed production export markers.')
    console.error('  npm run seed:prod-export-markers -- --confirm')
    process.exit(1)
  }

  if (ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    console.error(
      `SAFETY: NEXT_PUBLIC_SUPABASE_URL must be production (ref ${PRODUCTION_SUPABASE_PROJECT_REF}), got ${ref ?? 'unknown'}.`,
    )
    process.exit(1)
  }
}

async function main() {
  loadProdSupabaseEnv()
  assertProdExportMarkerSeedSafe()
  initSupabaseEnv()

  const consumerOwnerUserId = await findUserIdByEmail(PROD_CANARY.email)
  const advisorClientOwnerUserId = await findUserIdByEmail(PROD_ROLE_CANARIES.advisorClient.email)

  if (!consumerOwnerUserId) {
    console.error(`Missing auth user ${PROD_CANARY.email} — run npm run seed:prod-canary -- --confirm first.`)
    process.exit(1)
  }
  if (!advisorClientOwnerUserId) {
    console.error(
      `Missing auth user ${PROD_ROLE_CANARIES.advisorClient.email} — run npm run seed:prod-role-canaries -- --confirm first.`,
    )
    process.exit(1)
  }

  console.log(`Consumer owner:       ${consumerOwnerUserId} (${PROD_CANARY.email})`)
  console.log(`Advisor-client owner: ${advisorClientOwnerUserId} (${PROD_ROLE_CANARIES.advisorClient.email})`)

  await seedExportIsolationMarkers(consumerOwnerUserId, advisorClientOwnerUserId)

  console.log('\n✅ Export isolation markers seeded on production (idempotent upsert).')
  console.log('   Run prod smoke: npm run test:e2e:prod:smoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

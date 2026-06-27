/**
 * Production advisor canary — firm bootstrap for invite→accept (Track 2).
 *
 * Transcribes staging's ensureAdvisorFirmForE2e via ensureAdvisorFirmBootstrap,
 * using subscription_status: 'trialing' (clears getAdvisorClientCapacity, no Stripe).
 *
 * Run AFTER seed:prod-role-canaries, BEFORE consumer invite-advisor.
 *
 * Usage (manual only — never CI):
 *   npm run seed:prod-advisor-firm -- --confirm
 *
 * Optional: PROD_ADVISOR_CANARY_EMAIL=canary-advisor@mywealthmaps.com
 *
 * Requires .env.projects.local with PROD_* Supabase vars.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { PROD_ROLE_CANARIES } from './e2e-test-identities'
import {
  ensureAdvisorFirmBootstrap,
  findUserIdByEmail,
  initSupabaseEnv,
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

function assertProdAdvisorFirmSeedSafe(): void {
  const confirm = process.argv.includes('--confirm')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = extractSupabaseProjectRef(url)

  console.log('\n========================================')
  console.log('PROD ADVISOR CANARY FIRM BOOTSTRAP')
  console.log(`TARGET: ${ref ?? '(unparsed)'} (${url})`)
  console.log('STATUS: trialing (accept-request gate, no Stripe charge)')
  console.log('========================================\n')

  if (!confirm) {
    console.error('SAFETY: pass --confirm to bootstrap production advisor firm.')
    console.error('  npm run seed:prod-advisor-firm -- --confirm')
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
  assertProdAdvisorFirmSeedSafe()
  initSupabaseEnv()

  const email =
    process.env.PROD_ADVISOR_CANARY_EMAIL?.trim() || PROD_ROLE_CANARIES.advisor.email
  const firmName = `${PROD_ROLE_CANARIES.advisor.fullName} Firm`

  const advisorUserId = await findUserIdByEmail(email)
  if (!advisorUserId) {
    console.error(`Advisor profile not found for ${email}`)
    console.error('Run first: npm run seed:prod-role-canaries -- --confirm')
    process.exit(1)
  }

  console.log(`=== Firm bootstrap: ${email} (${advisorUserId}) ===\n`)

  const firmId = await ensureAdvisorFirmBootstrap(advisorUserId, firmName, 'trialing')

  console.log('\n=== Done ===')
  console.log(`firm_id: ${firmId}`)
  console.log('subscription_status: trialing')
  console.log('\nNext (in order):')
  console.log('  1. Consumer canary invites this advisor (invite-advisor)')
  console.log('  2. Advisor accepts pending request (accept-request → expect 200)')
  console.log('  3. Manual isolation hand-check (negative case deliberate)')
  console.log('\nIf accept 403s, diff ensureAdvisorFirmBootstrap output against staging — do not re-invite (409).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

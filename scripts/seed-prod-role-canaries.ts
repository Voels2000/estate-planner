/**
 * Seed production role canaries — login smoke only (OPTIONAL; staging is the default for role E2E).
 *
 * Prefer staging for advisor / attorney / advisor-empty / advisor-client coverage
 * (`npm run test:e2e:staging`). Use this only if you explicitly need prod role logins.
 *
 * Creates auth users for advisor, advisor-empty, attorney, and advisor-client on
 * PRODUCTION Supabase. Intentionally minimal:
 *   - No Stripe subscriptions or firm billing state
 *   - No advisor→client links or authorization flows
 *   - No attorney listing / checkout configuration
 *
 * Usage (manual only — never CI):
 *   E2E_CANARY_PASSWORD='…same as consumer canary…' npm run seed:prod-role-canaries -- --confirm
 *
 * Requires .env.projects.local with PROD_* Supabase vars.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { PROD_ROLE_CANARIES } from './e2e-test-identities'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAuthUser, initSupabaseEnv } from './seed-e2e-lib'

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

function assertProdRoleCanarySeedSafe(): void {
  const confirm = process.argv.includes('--confirm')
  const password = process.env.E2E_CANARY_PASSWORD?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = extractSupabaseProjectRef(url)

  console.log('\n========================================')
  console.log('PROD ROLE CANARY SEED (login-only)')
  console.log(`TARGET: ${ref ?? '(unparsed)'} (${url})`)
  console.log('========================================\n')

  if (!confirm) {
    console.error('SAFETY: pass --confirm to seed production role canaries.')
    console.error(
      "  E2E_CANARY_PASSWORD='…' npm run seed:prod-role-canaries -- --confirm",
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
    console.error('SAFETY: set E2E_CANARY_PASSWORD (≥12 chars, same as consumer canary).')
    process.exit(1)
  }
}

async function seedLoginOnlyAdvisor(
  email: string,
  password: string,
  fullName: string,
): Promise<string> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const userId = await ensureAuthUser({
    email,
    password,
    fullName,
    role: 'advisor',
  })

  await admin
    .from('profiles')
    .update({
      full_name: fullName,
      role: 'advisor',
      email,
      subscription_status: null,
      consumer_tier: 1,
      firm_id: null,
      firm_role: null,
      firm_name: null,
      is_superuser: false,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      updated_at: now,
    })
    .eq('id', userId)

  const { error: linkErr } = await admin.from('advisor_clients').delete().eq('advisor_id', userId)
  if (linkErr) console.warn(`  advisor_clients purge (${email}):`, linkErr.message)

  console.log(`  ✅ ${email} (advisor, login-only)`)
  return userId
}

async function seedLoginOnlyAttorney(
  email: string,
  password: string,
  fullName: string,
): Promise<string> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const userId = await ensureAuthUser({
    email,
    password,
    fullName,
    role: 'attorney',
  })

  await admin
    .from('profiles')
    .update({
      full_name: fullName,
      role: 'attorney',
      email,
      attorney_tier: 0,
      subscription_status: null,
      consumer_tier: 1,
      firm_id: null,
      firm_role: null,
      firm_name: null,
      is_superuser: false,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      updated_at: now,
    })
    .eq('id', userId)

  console.log(`  ✅ ${email} (attorney, login-only)`)
  return userId
}

async function seedLoginOnlyAdvisorClient(
  email: string,
  password: string,
  fullName: string,
  householdName: string,
): Promise<{ userId: string; householdId: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const userId = await ensureAuthUser({
    email,
    password,
    fullName,
    role: 'consumer',
  })

  await admin
    .from('profiles')
    .update({
      full_name: fullName,
      role: 'consumer',
      email,
      consumer_tier: 1,
      subscription_status: null,
      firm_id: null,
      firm_role: null,
      is_superuser: false,
      terms_accepted_at: now,
      terms_version: '2026-06-02',
      onboarding_wizard_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)

  const householdPayload = {
    owner_id: userId,
    name: householdName,
    person1_name: fullName,
    person1_first_name: fullName.split(' ')[0] ?? fullName,
    person1_last_name: fullName.split(' ').slice(1).join(' ') || 'Client',
    person1_birth_year: 1975,
    filing_status: 'single',
    state_primary: 'WA',
    updated_at: now,
  }

  const { data: existing } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  let householdId: string
  if (existing?.id) {
    householdId = existing.id
    const { error } = await admin.from('households').update(householdPayload).eq('id', householdId)
    if (error) throw new Error(`household update: ${error.message}`)
  } else {
    const { data, error } = await admin
      .from('households')
      .insert(householdPayload)
      .select('id')
      .single()
    if (error || !data?.id) throw new Error(`household insert: ${error?.message ?? 'no id'}`)
    householdId = data.id
  }

  console.log(`  ✅ ${email} (consumer, login-only household ${householdId})`)
  return { userId, householdId }
}

async function main() {
  loadProdSupabaseEnv()
  assertProdRoleCanarySeedSafe()
  initSupabaseEnv()

  const password = process.env.E2E_CANARY_PASSWORD!.trim()
  const { advisor, advisorEmpty, attorney, advisorClient } = PROD_ROLE_CANARIES

  console.log('=== Production role canaries (login-only) ===\n')

  await seedLoginOnlyAdvisor(advisor.email, password, advisor.fullName)
  await seedLoginOnlyAdvisor(advisorEmpty.email, password, advisorEmpty.fullName)
  await seedLoginOnlyAttorney(attorney.email, password, attorney.fullName)
  const { householdId } = await seedLoginOnlyAdvisorClient(
    advisorClient.email,
    password,
    advisorClient.fullName,
    advisorClient.householdName,
  )

  console.log('\n=== Add to .env.test.production (prod smoke) ===\n')
  console.log(`PLAYWRIGHT_ADVISOR_EMAIL=${advisor.email}`)
  console.log('PLAYWRIGHT_ADVISOR_PASSWORD=<E2E_CANARY_PASSWORD — do not commit>')
  console.log(`PLAYWRIGHT_ADVISOR_EMPTY_EMAIL=${advisorEmpty.email}`)
  console.log('PLAYWRIGHT_ADVISOR_EMPTY_PASSWORD=<E2E_CANARY_PASSWORD — do not commit>')
  console.log(`PLAYWRIGHT_ATTORNEY_EMAIL=${attorney.email}`)
  console.log('PLAYWRIGHT_ATTORNEY_PASSWORD=<E2E_CANARY_PASSWORD — do not commit>')
  console.log(`PLAYWRIGHT_ADVISOR_CLIENT_EMAIL=${advisorClient.email}`)
  console.log('PLAYWRIGHT_ADVISOR_CLIENT_PASSWORD=<E2E_CANARY_PASSWORD — do not commit>')
  console.log(`PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID=${householdId}`)
  console.log(
    '\nProd smoke: role setups authenticate only — billing and advisor authorization tests are staging-scoped.',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

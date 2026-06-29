/**
 * Reset avoels@outlook.com on production to signup-ready consumer state.
 *
 * Wipes household + financial data but keeps the auth user (no re-confirm email).
 * Sets consumer_tier=1, subscription_status=none, clears Stripe billing columns.
 *
 * Usage (manual only — never CI):
 *   npm run reset:prod-voels-consumer -- --confirm
 *
 * Requires .env.projects.local with PROD_* Supabase vars.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createAdminClient } from '@/lib/supabase/admin'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'

const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'
const TARGET_EMAIL = 'avoels@outlook.com'

function getProjectsVar(name: string, contents: string): string {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return match?.[1]?.trim().replace(/\r$/, '') ?? ''
}

function loadProdSupabaseEnv(): void {
  const projectsFile = join(process.cwd(), '.env.projects.local')
  if (!existsSync(projectsFile)) {
    console.error('Missing .env.projects.local')
    process.exit(1)
  }

  const contents = readFileSync(projectsFile, 'utf8')
  for (const [target, source] of [
    ['NEXT_PUBLIC_SUPABASE_URL', 'PROD_NEXT_PUBLIC_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'PROD_SUPABASE_SERVICE_ROLE_KEY'],
    ['SUPABASE_DB_URL', 'PROD_SUPABASE_DB_URL'],
  ] as const) {
    const val = getProjectsVar(source, contents)
    if (!val) {
      console.error(`Missing ${source}`)
      process.exit(1)
    }
    process.env[target] = val
  }
}

function assertProdResetSafe(): void {
  const confirm = process.argv.includes('--confirm')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  console.log('\n========================================')
  console.log('PROD VOELS CONSUMER RESET')
  console.log(`TARGET: ${ref ?? '(unparsed)'} (${url})`)
  console.log(`EMAIL:  ${TARGET_EMAIL}`)
  console.log('========================================\n')

  if (!confirm) {
    console.error('SAFETY: pass --confirm to reset production Voels consumer.')
    console.error('  npm run reset:prod-voels-consumer -- --confirm')
    process.exit(1)
  }

  if (ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    console.error(`SAFETY: must target production ref ${PRODUCTION_SUPABASE_PROJECT_REF}, got ${ref ?? 'unknown'}.`)
    process.exit(1)
  }
}

async function deleteByOwner(admin: ReturnType<typeof createAdminClient>, table: string, ownerId: string) {
  const { error, count } = await admin.from(table).delete({ count: 'exact' }).eq('owner_id', ownerId)
  if (error) throw new Error(`${table} delete: ${error.message}`)
  if (count) console.log(`  ${table}: deleted ${count}`)
}

async function deleteByUserId(admin: ReturnType<typeof createAdminClient>, table: string, userId: string) {
  const { error, count } = await admin.from(table).delete({ count: 'exact' }).eq('user_id', userId)
  if (error) throw new Error(`${table} delete: ${error.message}`)
  if (count) console.log(`  ${table}: deleted ${count}`)
}

async function main() {
  loadProdSupabaseEnv()
  assertProdResetSafe()
  initSupabaseEnv()

  const admin = createAdminClient()
  const userId = await findUserIdByEmail(TARGET_EMAIL)
  if (!userId) {
    console.error(`Auth user not found: ${TARGET_EMAIL}`)
    process.exit(1)
  }

  const { data: household } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  console.log(`user_id: ${userId}`)
  console.log(`household_id: ${household?.id ?? '(none)'}`)

  console.log('\nWiping owner-scoped rows…')
  for (const table of [
    'assets',
    'income',
    'expenses',
    'liabilities',
    'real_estate',
    'businesses',
    'business_interests',
    'trusts',
    'digital_assets',
    'estate_documents',
  ] as const) {
    await deleteByOwner(admin, table, userId)
  }
  await deleteByUserId(admin, 'insurance_policies', userId)

  for (const [table, column] of [
    ['funnel_events', 'user_id'],
    ['monte_carlo_runs', 'user_id'],
    ['life_events', 'user_id'],
    ['assessment_results', 'user_id'],
    ['notifications', 'user_id'],
  ] as const) {
    const { error, count } = await admin.from(table).delete({ count: 'exact' }).eq(column, userId)
    if (error) console.warn(`  ${table}: ${error.message}`)
    else if (count) console.log(`  ${table}: deleted ${count}`)
  }

  if (household?.id) {
    console.log('\nWiping household-scoped rows…')
    for (const table of [
      'estate_recommendations',
      'monte_carlo_results',
      'estate_composition_cache',
      'estate_health_scores',
      'estate_health_check',
      'household_alerts',
      'strategy_configs',
      'strategy_line_items',
      'gift_history',
      'beneficiary_conflicts',
      'household_people',
      'projection_scenarios',
    ] as const) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('household_id', household.id)
      if (error) throw new Error(`${table} delete: ${error.message}`)
      if (count) console.log(`  ${table}: deleted ${count}`)
    }

    await admin.from('advisor_clients').delete().eq('client_id', userId)
    const { error: hhErr } = await admin.from('households').delete().eq('id', household.id)
    if (hhErr) throw new Error(`households delete: ${hhErr.message}`)
    console.log('  households: deleted')
  }

  await admin.from('one_time_purchases').delete().eq('user_id', userId)

  const now = new Date().toISOString()
  const { data: updated, error: profileErr } = await admin
    .from('profiles')
    .update({
      role: 'consumer',
      consumer_tier: 1,
      subscription_status: 'none',
      subscription_plan: null,
      subscription_period_end: null,
      has_ever_subscribed: false,
      trial_ends_at: null,
      trial_started_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      onboarding_wizard_completed_at: null,
      onboarding_invite_advisor_completed_at: null,
      terms_accepted_at: null,
      terms_version: null,
      is_superuser: false,
      updated_at: now,
    })
    .eq('id', userId)
    .select('email, consumer_tier, subscription_status, stripe_customer_id, stripe_subscription_id')
    .single()

  if (profileErr) throw new Error(`profile update: ${profileErr.message}`)

  console.log('\n✅ Profile reset (auth user preserved):')
  console.log(JSON.stringify(updated, null, 2))

  const { count: assetCount } = await admin
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)
  const { data: hhCheck } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  console.log('\nVerification:')
  console.log(`  consumer_tier: ${updated?.consumer_tier} (expect 1)`)
  console.log(`  subscription_status: ${updated?.subscription_status} (expect none)`)
  console.log(`  assets: ${assetCount ?? 0} (expect 0)`)
  console.log(`  household: ${hhCheck?.id ?? '(none)'} (expect none)`)
  console.log('\nLog in at https://www.mywealthmaps.com/login — onboarding/wizard should start fresh.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

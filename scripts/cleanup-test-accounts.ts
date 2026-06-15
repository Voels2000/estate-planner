import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import { deleteUserData } from '../lib/compliance/deleteUser'
import {
  E2E_IDENTITIES,
  LEGACY_E2E_EMAILS,
  ROLOBE_ACCOUNTS,
  DRIP_SMOKE_EMAIL,
} from './e2e-test-identities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

/** Production Supabase project ref — destructive cleanup refused unless --force */
const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

function extractSupabaseProjectRef(url: string): string | null {
  try {
    const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/** Loud target banner + abort on production unless --force. Runs before any deletion. */
function assertPurgeTargetSafe(): void {
  const projectRef = extractSupabaseProjectRef(supabaseUrl)
  const force = process.argv.includes('--force')

  console.log('\n========================================')
  console.log(`PURGE TARGET: ${projectRef ?? '(unparsed ref)'} (${supabaseUrl})`)
  console.log('========================================\n')

  if (!projectRef) {
    console.error('SAFETY: could not parse Supabase project ref from SUPABASE_URL — aborting.')
    process.exit(1)
  }

  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF && !force) {
    console.error(
      `SAFETY: refusing destructive cleanup on production Supabase (ref: ${PRODUCTION_SUPABASE_PROJECT_REF}).`,
    )
    console.error('Pass --force only if you intentionally target production.')
    process.exit(1)
  }
}

/** Pre-go-live clutter — early rolobe captures without full accounts */
const DELETE_EMAILS = [
  'consumer3@rolobe.resend.app',
  'consumer5@rolobe.resend.app',
  'consumer11@rolobe.resend.app',
  'consumer15@rolobe.resend.app',
  'consumer17@rolobe.resend.app',
  'consumer18@rolobe.resend.app',
  'consumer19@rolobe.resend.app',
  'consumer20@rolobe.resend.app',
]

/** Real demo / user-specific accounts — never delete via bulk cleanup */
const GO_LIVE_PROTECTED = [
  'avoels@comcast.net',
  'avoels@outlook.com',
  'david@gmail.com',
  'Stephen.a.voels@sbcglobal.net',
  // prod consumer canary — E2E target, never delete
  'canary-consumer@mywealthmaps.com',
]

/** Canonical @mywealthmaps.test — never delete */
const CANONICAL_PROTECTED = [
  E2E_IDENTITIES.consumer.email,
  E2E_IDENTITIES.consumerTier1.email,
  E2E_IDENTITIES.goldenPathStage1.email,
  E2E_IDENTITIES.advisor.email,
  E2E_IDENTITIES.advisorEmpty.email,
  E2E_IDENTITIES.advisorClient.email,
  E2E_IDENTITIES.attorneyPortal.email,
  E2E_IDENTITIES.advisorListing.email,
  E2E_IDENTITIES.attorneyListing.email,
  DRIP_SMOKE_EMAIL,
]

/**
 * @rolobe accounts protected from --legacy until explicitly removed via --rolobe.
 */
const ROLOBE_PROTECTED_FROM_LEGACY = [...ROLOBE_ACCOUNTS]

const PROTECTED = [...CANONICAL_PROTECTED, ...GO_LIVE_PROTECTED, ...ROLOBE_PROTECTED_FROM_LEGACY]

function isProtectedEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const lower = email.toLowerCase()
  return PROTECTED.some((p) => p.toLowerCase() === lower)
}

const LEGACY_DELETE_CANDIDATES = LEGACY_E2E_EMAILS.filter((e) => !PROTECTED.includes(e))

async function listAllAuthUsers() {
  const users: Awaited<ReturnType<typeof supabase.auth.admin.listUsers>>['data']['users'] = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) break
    page++
  }

  return users
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${message} [y/N] `)
  rl.close()
  return answer.trim().toLowerCase() === 'y'
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (profile?.id) return profile.id

  const { data: authData, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    console.error(`listUsers error: ${error.message}`)
    return null
  }
  return authData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

async function deleteEmailCaptures(email: string): Promise<void> {
  const { error, count } = await supabase
    .from('email_captures')
    .delete({ count: 'exact' })
    .eq('email', email)
  if (error) {
    console.log(`email_captures ${email}: ${error.message}`)
  } else {
    console.log(`email_captures ${email}: deleted ${count ?? 0}`)
  }
}

async function logDeletionAudit(
  userId: string,
  email: string,
  initiatedBy: string,
): Promise<void> {
  await supabase.from('deletion_audit_log').insert({
    user_id: userId,
    email,
    reason: 'admin_initiated',
    initiated_by: initiatedBy,
    dry_run: false,
    auth_deleted: true,
    success: true,
    completed_at: new Date().toISOString(),
  })
}

/** Hard-delete auth user; fall back to soft-delete when FK constraints block removal. */
async function deleteAuthUserById(userId: string, email: string): Promise<boolean> {
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (!error) return true

  if (error.message.includes('Database error')) {
    const { error: softErr } = await supabase.auth.admin.deleteUser(userId, true)
    if (!softErr) {
      console.log(`auth user ${email}: soft-deleted (hard delete blocked by FK)`)
      return true
    }
    console.error(`auth user ${email}: ${softErr.message}`)
    return false
  }

  console.error(`auth user ${email}: ${error.message}`)
  return false
}

/** Auth user exists but no profile — delete Auth user directly by email lookup. */
async function deleteAuthUserDirectly(email: string): Promise<boolean> {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) {
    console.log(`auth user ${email}: not found in auth`)
    return false
  }

  const deleted = await deleteAuthUserById(authUser.id, email)
  if (!deleted) return false

  console.log(`auth user ${email}: deleted directly (no profile)`)
  await logDeletionAudit(authUser.id, email, 'cli-rolobe-cleanup')
  return true
}

async function deleteRoblobeAccountFallback(email: string, userId: string): Promise<boolean> {
  console.log(`fallback cleanup ${email} (deleteUserData schema mismatch)`)

  const { data: households } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
  const householdIds = (households ?? []).map((h) => h.id)

  const safeDelete = async (table: string, column: string, value: string) => {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq(column, value)
    if (error) console.log(`  ${table}: ${error.message}`)
    else if ((count ?? 0) > 0) console.log(`  ${table}: deleted ${count}`)
  }

  for (const householdId of householdIds) {
    await safeDelete('estate_recommendations', 'household_id', householdId)
    await safeDelete('estate_health_scores', 'household_id', householdId)
    await safeDelete('estate_health_check', 'household_id', householdId)
    await safeDelete('gift_history', 'household_id', householdId)
    await safeDelete('strategy_line_items', 'household_id', householdId)
    await safeDelete('beneficiary_conflicts', 'household_id', householdId)
    await safeDelete('household_people', 'household_id', householdId)
  }

  await safeDelete('estate_recommendations', 'owner_id', userId)
  await safeDelete('households', 'owner_id', userId)
  for (const table of [
    'assets',
    'income',
    'expenses',
    'liabilities',
    'real_estate',
    'businesses',
    'trusts',
    'digital_assets',
    'ingestion_jobs',
  ]) {
    await safeDelete(table, 'owner_id', userId)
  }
  for (const table of ['insurance_policies', 'life_events', 'funnel_events', 'assessment_results']) {
    await safeDelete(table, 'user_id', userId)
  }
  await safeDelete('notifications', 'user_id', userId)
  await supabase.from('advisor_clients').delete().or(`advisor_id.eq.${userId},client_id.eq.${userId}`)
  await supabase.from('connection_requests').delete().eq('consumer_id', userId)
  await supabase
    .from('referral_clicks')
    .delete()
    .or(`advisor_id.eq.${userId},attorney_profile_id.eq.${userId}`)

  const { error: profileErr } = await supabase.from('profiles').delete().eq('id', userId)
  if (profileErr) console.log(`  profiles: ${profileErr.message}`)

  const deleted = await deleteAuthUserById(userId, email)
  if (!deleted) return false

  console.log(`auth user ${email}: deleted via fallback cleanup`)
  await logDeletionAudit(userId, email, 'cli-rolobe-cleanup-fallback')
  return true
}

async function deleteAccountWithAudit(email: string, useFallback = false): Promise<boolean> {
  if (isProtectedEmail(email)) {
    console.error(`SAFETY: refusing to delete protected account ${email}`)
    return false
  }

  await deleteEmailCaptures(email)

  const userId = await findUserIdByEmail(email)
  if (!userId) {
    console.log(`auth user ${email}: not found (captures only)`)
    return true
  }

  const result = await deleteUserData({
    userId,
    email,
    reason: 'admin_initiated',
    initiatedBy: 'scripts/cleanup-test-accounts.ts',
    supabaseUrl,
    supabaseServiceKey: serviceKey,
  })

  if (!result.success) {
    if (result.error?.includes('Profile not found')) {
      return deleteAuthUserDirectly(email)
    }
    if (useFallback) {
      return deleteRoblobeAccountFallback(email, userId)
    }
    console.error(`deleteUserData ${email}: ${result.error ?? 'failed'}`)
    return false
  }

  console.log(
    `deleted ${email}: auth=${result.authUserDeleted} tables=${result.tablesCleared.length}`,
  )
  return true
}

async function runLegacyCleanup(emails: string[]) {
  for (const email of emails) {
    if (isProtectedEmail(email)) {
      console.error(`SAFETY: refusing to delete protected account ${email}`)
      continue
    }
    await deleteAccountWithAudit(email)
  }
}

async function runPurgeUnprotected() {
  const dryRun = process.argv.includes('--dry-run')
  const autoYes = process.argv.includes('--yes')
  const allUsers = await listAllAuthUsers()

  const protectedUsers = allUsers.filter((u) => isProtectedEmail(u.email))
  const deleteCandidates = allUsers.filter((u) => u.email && !isProtectedEmail(u.email))

  console.log(`\nAuth users total: ${allUsers.length}`)
  console.log(`Protected (keeping): ${protectedUsers.length}`)
  for (const u of protectedUsers.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))) {
    console.log(`  KEEP  ${u.email}`)
  }

  console.log(`\nTo delete: ${deleteCandidates.length}`)
  for (const u of deleteCandidates.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))) {
    console.log(`  DEL   ${u.email ?? u.id}`)
  }

  if (deleteCandidates.length === 0) {
    console.log('\nNothing to delete.')
    return
  }

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made. Re-run with --purge-unprotected --yes to execute.')
    return
  }

  if (!autoYes) {
    console.log(
      '\nEach deletion uses lib/compliance/deleteUser.ts (WCPA audit log + verification).',
    )
    console.log('Protected list: CANONICAL + GO_LIVE_PROTECTED + rolobe (until --rolobe).\n')
    const ok = await confirm('Permanently delete all unprotected auth users listed above?')
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
  }

  let deleted = 0
  let failed = 0

  for (const user of deleteCandidates) {
    const email = user.email ?? user.id
    console.log(`\n--- ${email} ---`)
    const success = await deleteAccountWithAudit(email)
    if (success) deleted++
    else failed++
  }

  console.log(`\nPurge summary: ${deleted} deleted, ${failed} failed`)
  console.log('Re-seed automation: npm run seed:e2e')
  console.log('Verify: npm run verify:estate:e2e')
}

async function runRoblobeCleanup() {
  const emails: string[] = []
  for (const email of ROLOBE_ACCOUNTS) {
    if (await findUserIdByEmail(email)) emails.push(email)
  }

  if (emails.length === 0) {
    console.log('\nNo remaining @rolobe.resend.app auth users found.')
    return
  }

  console.log('\nThe following @rolobe.resend.app accounts will be permanently deleted:\n')
  for (const email of emails) {
    console.log(`  - ${email}`)
  }
  console.log('\nDeletions are logged to deletion_audit_log via deleteUserData.')
  console.log('Canonical @mywealthmaps.test accounts are NOT affected.\n')

  const ok = await confirm('Proceed with rolobe account deletion?')
  if (!ok) {
    console.log('Aborted.')
    process.exit(0)
  }

  let deleted = 0
  let failed = 0

  for (const email of emails) {
    const success = await deleteAccountWithAudit(email, true)
    if (success) deleted++
    else failed++
  }

  console.log(`\nSummary: ${deleted} processed, ${failed} failed`)
  console.log('Remove ROLOBE_PROTECTED_FROM_LEGACY entries from this script after confirming deletion.')
}

async function main() {
  assertPurgeTargetSafe()

  if (process.argv.includes('--purge-unprotected')) {
    await runPurgeUnprotected()
    return
  }

  if (process.argv.includes('--rolobe')) {
    await runRoblobeCleanup()
    return
  }

  const emails = process.argv.includes('--legacy')
    ? [...new Set([...DELETE_EMAILS, ...LEGACY_DELETE_CANDIDATES])]
    : DELETE_EMAILS

  if (process.argv.includes('--legacy')) {
    console.log('Including legacy E2E emails (--legacy). Protected list still enforced.\n')
  }

  await runLegacyCleanup(emails)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

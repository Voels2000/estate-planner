import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import { deleteUserData } from '../lib/compliance/deleteUser'
import {
  E2E_IDENTITIES,
  LEGACY_E2E_EMAILS,
  ROLOBE_ACCOUNTS,
} from './e2e-test-identities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

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

/** Canonical @mywealthmaps.test — never delete */
const CANONICAL_PROTECTED = [
  E2E_IDENTITIES.consumer.email,
  E2E_IDENTITIES.consumerTier1.email,
  E2E_IDENTITIES.advisor.email,
  E2E_IDENTITIES.advisorClient.email,
  E2E_IDENTITIES.attorneyPortal.email,
  E2E_IDENTITIES.advisorListing.email,
  E2E_IDENTITIES.attorneyListing.email,
  'e2e-drip@mywealthmaps.test',
]

/**
 * @rolobe accounts protected from --legacy until explicitly removed via --rolobe.
 * consumer21 was the drip inbox check — now replaced by verify-drip-sequence.ts.
 */
const ROLOBE_PROTECTED_FROM_LEGACY = [...ROLOBE_ACCOUNTS]

const PROTECTED = [...CANONICAL_PROTECTED, ...ROLOBE_PROTECTED_FROM_LEGACY]

const LEGACY_DELETE_CANDIDATES = LEGACY_E2E_EMAILS.filter((e) => !PROTECTED.includes(e))

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

async function deleteAccountWithAudit(email: string): Promise<boolean> {
  if (CANONICAL_PROTECTED.includes(email)) {
    console.error(`SAFETY: refusing to delete canonical account ${email}`)
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
    if (PROTECTED.includes(email)) {
      console.error(`SAFETY: refusing to delete protected account ${email}`)
      continue
    }
    await deleteAccountWithAudit(email)
  }
}

async function runRoblobeCleanup() {
  const emails = [...ROLOBE_ACCOUNTS]
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
    const success = await deleteAccountWithAudit(email)
    if (success) deleted++
    else failed++
  }

  console.log(`\nSummary: ${deleted} processed, ${failed} failed`)
  console.log('Remove ROLOBE_PROTECTED_FROM_LEGACY entries from this script after confirming deletion.')
}

async function main() {
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

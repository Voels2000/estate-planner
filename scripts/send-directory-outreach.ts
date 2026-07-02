/**
 * send-directory-outreach.ts
 *
 * Sends first-outreach (or reminder) emails to unclaimed directory rows with claim_token.
 * Dry-run by default; ref-guarded like import-directory-seed.ts.
 *
 *   SUPABASE_DB_REF=cmzyxpxfyvdvbsykjvsg SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     RESEND_API_KEY=re_... NEXT_PUBLIC_APP_URL=https://estate-planner-staging.vercel.app \
 *     npx tsx scripts/send-directory-outreach.ts --role attorney --limit 5
 *
 *   ...same... --commit
 */

import { createClient } from '@supabase/supabase-js'
import { outreachFirstNameFromContact } from '@/lib/directory/outreachRecipient'
import { sendDirectoryOutreachEmail } from '@/lib/emails/sendDirectoryOutreachEmail'

const REFS: Record<string, 'staging' | 'production'> = {
  cmzyxpxfyvdvbsykjvsg: 'staging',
  fnzvlmrqwcqwiqueevux: 'production',
}

type Role = 'attorney' | 'advisor' | 'all'

type Args = {
  role: Role
  limit: number
  commit: boolean
  reminder: boolean
  afterDays: number
  outreachSeedOnly: boolean
}

function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  let role: Role = 'all'
  let limit = 10
  let commit = false
  let reminder = false
  let afterDays = 7
  let outreachSeedOnly = true

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--commit') commit = true
    else if (a === '--reminder') reminder = true
    else if (a === '--include-all-sources') outreachSeedOnly = false
    else if (a === '--role') {
      const v = (argv[++i] ?? '').toLowerCase()
      if (v === 'attorney' || v === 'advisor' || v === 'all') role = v
      else fail('--role must be attorney, advisor, or all')
    } else if (a === '--limit') {
      limit = Number(argv[++i])
      if (!Number.isFinite(limit) || limit < 1) fail('--limit must be a positive number')
    } else if (a === '--after-days') {
      afterDays = Number(argv[++i])
      if (!Number.isFinite(afterDays) || afterDays < 1) fail('--after-days must be a positive number')
    } else if (a.startsWith('--')) fail(`Unknown flag: ${a}`)
  }

  return { role, limit, commit, reminder, afterDays, outreachSeedOnly }
}

type ListingRow = {
  id: string
  email: string | null
  claim_token: string | null
  firm_name: string | null
  contact_name: string | null
  claimed_at: string | null
  outreach_sent_at: string | null
  outreach_reminder_sent_at: string | null
  outreach_send_count: number | null
  source: string | null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const dbRef = process.env.SUPABASE_DB_REF ?? ''
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!dbRef) fail('SUPABASE_DB_REF not set.')
  const env = REFS[dbRef]
  if (!env) fail(`Unknown SUPABASE_DB_REF "${dbRef}". Expected staging or prod ref.`)
  if (!supabaseUrl || !serviceRole) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.')
  if (!supabaseUrl.includes(dbRef)) {
    fail(`SUPABASE_URL does not contain ref "${dbRef}". Refusing mismatched project.`)
  }
  if (env === 'production' && args.commit && process.env.ALLOW_PRODUCTION_SEND !== 'true') {
    fail('Refusing production send without ALLOW_PRODUCTION_SEND=true.')
  }
  if (args.commit && !process.env.RESEND_API_KEY?.trim()) {
    fail('RESEND_API_KEY required for --commit.')
  }
  if (args.commit && !process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    fail('NEXT_PUBLIC_APP_URL required for --commit (magic link redirect).')
  }

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })

  const tables: Array<{ table: 'attorney_listings' | 'advisor_directory'; role: 'attorney' | 'advisor' }> =
    args.role === 'all'
      ? [
          { table: 'attorney_listings', role: 'attorney' },
          { table: 'advisor_directory', role: 'advisor' },
        ]
      : args.role === 'attorney'
        ? [{ table: 'attorney_listings', role: 'attorney' }]
        : [{ table: 'advisor_directory', role: 'advisor' }]

  console.log('='.repeat(70))
  console.log(`DIRECTORY OUTREACH SEND — ${env.toUpperCase()} (${dbRef})`)
  console.log(
    `Mode: ${args.commit ? 'COMMIT' : 'DRY RUN'}  role=${args.role}  limit=${args.limit}  reminder=${args.reminder}`,
  )
  if (args.outreachSeedOnly) {
    console.log('Filter: source=outreach_seed only (--include-all-sources to disable)')
  }
  console.log('='.repeat(70))

  let totalSent = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const { table, role } of tables) {
    let query = admin
      .from(table)
      .select(
        'id, email, claim_token, firm_name, contact_name, claimed_at, outreach_sent_at, outreach_reminder_sent_at, outreach_send_count, source',
      )
      .is('claimed_at', null)
      .not('claim_token', 'is', null)
      .limit(args.limit)

    if (args.outreachSeedOnly) {
      query = query.eq('source', 'outreach_seed')
    }

    query = args.reminder
      ? query
          .not('outreach_sent_at', 'is', null)
          .is('outreach_reminder_sent_at', null)
          .lt(
            'outreach_sent_at',
            new Date(Date.now() - args.afterDays * 86_400_000).toISOString(),
          )
      : query.is('outreach_sent_at', null)

    const { data: rows, error } = await query

    if (error) {
      if (error.message.includes('outreach_sent_at')) {
        fail(
          `Column outreach_sent_at missing on ${table}. Apply migration 20260802120000_directory_outreach_send_tracking.sql first.`,
        )
      }
      fail(`[${table}] query failed: ${error.message}`)
    }

    console.log(`\n[${table}] ${rows?.length ?? 0} candidate row(s)`)

    for (const row of (rows ?? []) as ListingRow[]) {
      if (!row.email?.trim() || !row.claim_token?.trim()) {
        console.log(`  skip ${row.id} — missing email or claim_token`)
        totalSkipped++
        continue
      }

      const firmName = row.firm_name?.trim() || 'your firm'
      const firstName = outreachFirstNameFromContact(row.contact_name)

      if (!args.commit) {
        console.log(`  [dry-run] would send to ${row.email} (${firmName}, hi ${firstName})`)
        continue
      }

      const result = await sendDirectoryOutreachEmail({
        role,
        email: row.email.trim(),
        claimToken: row.claim_token.trim(),
        firmName,
        firstName,
        senderName: process.env.DIRECTORY_OUTREACH_SENDER_NAME?.trim() || 'Alan Voels',
      })

      if (!result.ok) {
        console.error(`  FAILED ${row.email}: ${result.error}`)
        totalFailed++
        continue
      }

      const nextCount = (row.outreach_send_count ?? 0) + 1
      const updatePayload = args.reminder
        ? {
            outreach_reminder_sent_at: new Date().toISOString(),
            outreach_send_count: nextCount,
          }
        : {
            outreach_sent_at: new Date().toISOString(),
            outreach_send_count: nextCount,
          }

      const { error: updateError } = await admin.from(table).update(updatePayload).eq('id', row.id)

      if (updateError) {
        console.error(`  SENT but failed to record status for ${row.email}: ${updateError.message}`)
        totalFailed++
        continue
      }

      console.log(`  sent -> ${row.email} (resend id: ${result.resendId ?? 'n/a'})`)
      totalSent++
    }
  }

  console.log(
    `\n== Done == sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed}${
      args.commit ? '' : ' (dry-run — nothing sent)'
    }\n`,
  )

  if (totalFailed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

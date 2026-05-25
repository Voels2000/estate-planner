#!/usr/bin/env tsx
/**
 * Drip sequence verification script
 * Replaces manual inbox check of consumer21@rolobe.resend.app
 *
 * Usage:
 *   npx tsx scripts/verify-drip-sequence.ts --email test@example.com
 *   npx tsx scripts/verify-drip-sequence.ts --all  (checks all recent captures)
 *
 * Checks:
 *   1. email_captures row exists with drip_step_1_sent_at populated
 *   2. drip_step_2_sent_at populated (if day 3+ has passed)
 *   3. drip_step_3_sent_at populated (if day 7+ has passed)
 *   4. No unsubscribed_at unless expected
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { DRIP_SMOKE_EMAIL } from './e2e-test-identities'

const args = process.argv.slice(2)
const emailArg =
  args.find((a) => a.startsWith('--email='))?.split('=')[1] ??
  (args.includes('--email') ? args[args.indexOf('--email') + 1] : null)
const checkAll = args.includes('--all')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

type CaptureRow = {
  email: string
  created_at: string
  captured_at: string
  drip_step_1_sent_at: string | null
  drip_step_2_sent_at: string | null
  drip_step_3_sent_at: string | null
  unsubscribed_at: string | null
  source: string
}

function captureAgeDays(row: CaptureRow): number {
  const anchor = row.captured_at ?? row.created_at
  return Math.floor((Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24))
}

async function checkDripStatus(email?: string) {
  let query = admin
    .from('email_captures')
    .select(`
      email,
      created_at,
      captured_at,
      drip_step_1_sent_at,
      drip_step_2_sent_at,
      drip_step_3_sent_at,
      unsubscribed_at,
      source
    `)
    .order('created_at', { ascending: false })

  if (email) {
    query = query.eq('email', email)
  } else {
    query = query.limit(10)
  }

  const { data, error } = await query

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log(
      email
        ? `No email_captures row found for ${email}`
        : 'No recent email captures found',
    )
    if (email === DRIP_SMOKE_EMAIL) {
      console.log(
        `\nTip: capture ${DRIP_SMOKE_EMAIL} via /assess or homepage email capture, then re-run.`,
      )
    }
    process.exit(0)
  }

  console.log('\nDrip sequence status:\n')
  console.log(
    'Email'.padEnd(40),
    'Step 1'.padEnd(12),
    'Step 2'.padEnd(12),
    'Step 3'.padEnd(12),
    'Unsub',
  )
  console.log('─'.repeat(90))

  const rows = data as CaptureRow[]

  for (const row of rows) {
    const daysSinceCapture = captureAgeDays(row)

    const step1 = row.drip_step_1_sent_at ? '✅ sent' : '❌ not sent'
    const step2 = row.drip_step_2_sent_at
      ? '✅ sent'
      : daysSinceCapture >= 3
        ? '⚠️  overdue'
        : `⏳ day ${daysSinceCapture}/3`
    const step3 = row.drip_step_3_sent_at
      ? '✅ sent'
      : daysSinceCapture >= 7
        ? '⚠️  overdue'
        : `⏳ day ${daysSinceCapture}/7`
    const unsub = row.unsubscribed_at ? '🚫 yes' : '—'

    console.log(row.email.padEnd(40), step1.padEnd(12), step2.padEnd(12), step3.padEnd(12), unsub)
  }

  console.log()

  const overdue = rows.filter((row) => {
    const days = captureAgeDays(row)
    if (row.unsubscribed_at) return false
    return (days >= 3 && !row.drip_step_2_sent_at) || (days >= 7 && !row.drip_step_3_sent_at)
  })

  const missingStep1 = rows.filter((row) => !row.drip_step_1_sent_at && !row.unsubscribed_at)

  if (missingStep1.length > 0) {
    console.log(`⚠️  ${missingStep1.length} capture(s) missing drip step 1`)
    process.exit(1)
  }

  if (overdue.length > 0) {
    console.log(`⚠️  ${overdue.length} capture(s) have overdue drip steps`)
    process.exit(1)
  }

  console.log('✅ All drip sequences on schedule')
  process.exit(0)
}

checkDripStatus(emailArg ?? (checkAll ? undefined : undefined)).catch((err) => {
  console.error(err)
  process.exit(1)
})

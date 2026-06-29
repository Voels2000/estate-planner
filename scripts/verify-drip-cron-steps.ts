#!/usr/bin/env tsx
/**
 * Staging-only: prove drip cron steps 2 and 3 by backdating
 * e2e-drip@mywealthmaps.test and sending via Resend (same templates as /api/email/drip).
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/verify-drip-cron-steps.ts
 *   dotenv -e .env.local -- npx tsx scripts/verify-drip-cron-steps.ts --dry-run
 *
 * Restores original drip timestamps after the run unless --keep-backdate is passed.
 *
 * Optional: --remote --base-url=https://estate-planner-staging.vercel.app
 *   hits deployed /api/email/drip (requires matching INTERNAL_API_KEY on that deployment).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { DRIP_SMOKE_EMAIL } from './e2e-test-identities'
import { getDripSequence, buildDripEmailHtml } from '../lib/emails/drip-templates'
import { buildUnsubscribeUrl } from '../lib/email/unsubscribeToken'
import { EMAIL_FROM } from '../lib/email/config'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const keepBackdate = args.has('--keep-backdate')
const useRemote = args.has('--remote')
const baseUrlArg = process.argv.find((a) => a.startsWith('--base-url='))?.split('=')[1]

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const internalKey = process.env.INTERNAL_API_KEY
const remoteBase = (
  baseUrlArg ??
  process.env.DRIP_VERIFY_BASE_URL ??
  'https://estate-planner-staging.vercel.app'
).replace(/\/$/, '')

const dripLinkBase =
  (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com').replace(/\/$/, '') ||
  'https://mywealthmaps.com'

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (!useRemote && !resendKey) {
  console.error('Need RESEND_API_KEY in .env.local (or pass --remote with matching INTERNAL_API_KEY)')
  process.exit(1)
}
if (useRemote && !internalKey) {
  console.error('Need INTERNAL_API_KEY for --remote')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
const resend = resendKey ? new Resend(resendKey) : null

const DRIP_SENT_COLUMNS = {
  2: 'drip_step_2_sent_at',
  3: 'drip_step_3_sent_at',
} as const

type CaptureRow = {
  email: string
  source: string
  drip_step_1_sent_at: string | null
  drip_step_2_sent_at: string | null
  drip_step_3_sent_at: string | null
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

async function fetchCapture(): Promise<CaptureRow> {
  const { data, error } = await admin
    .from('email_captures')
    .select('email, source, drip_step_1_sent_at, drip_step_2_sent_at, drip_step_3_sent_at')
    .eq('email', DRIP_SMOKE_EMAIL)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    throw new Error(`No email_captures row for ${DRIP_SMOKE_EMAIL} — run npm run seed:e2e`)
  }
  return data as CaptureRow
}

async function sendDripStepLocal(capture: CaptureRow, step: 2 | 3): Promise<void> {
  const eventSlug = capture.source?.replace('event-assess-', '') ?? null
  const sequence = getDripSequence(eventSlug)
  const emailData = step === 2 ? sequence.email2 : sequence.email3
  const normalizedEmail = capture.email.trim().toLowerCase()
  const unsubscribeUrl = buildUnsubscribeUrl(dripLinkBase, normalizedEmail)
  const html = buildDripEmailHtml({
    email: emailData,
    recipientEmail: normalizedEmail,
    unsubscribeUrl,
  })

  const { error } = await resend!.emails.send({
    from: EMAIL_FROM,
    to: normalizedEmail,
    subject: emailData.subject,
    html,
  })
  if (error) throw new Error(`Resend step ${step}: ${JSON.stringify(error)}`)

  const sentColumn = DRIP_SENT_COLUMNS[step]
  const { error: updateError } = await admin
    .from('email_captures')
    .update({ [sentColumn]: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .eq('source', capture.source)

  if (updateError) throw new Error(`DB update step ${step}: ${updateError.message}`)
}

async function sendDripStepRemote(capture: CaptureRow, step: 2 | 3): Promise<void> {
  const eventSlug = capture.source?.replace('event-assess-', '') ?? null
  const res = await fetch(`${remoteBase}/api/email/drip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalKey!,
    },
    body: JSON.stringify({
      email: capture.email,
      source: capture.source,
      event_slug: eventSlug,
      sequence_step: step,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`remote drip step ${step}: HTTP ${res.status} ${body}`)
  }
}

async function sendDripStep(capture: CaptureRow, step: 2 | 3): Promise<void> {
  if (useRemote) await sendDripStepRemote(capture, step)
  else await sendDripStepLocal(capture, step)
}

async function main() {
  const original = await fetchCapture()
  const mode = useRemote ? `remote (${remoteBase})` : 'local Resend'
  console.log(`\nDrip cron verify [${mode}] — ${DRIP_SMOKE_EMAIL} (${original.source})\n`)

  if (!original.drip_step_1_sent_at) {
    throw new Error('drip_step_1_sent_at missing — seed or capture drip step 1 first')
  }

  if (dryRun) {
    console.log('Dry run — would backdate step 1 to 4d ago, send step 2, then step 3 at 8d ago')
    process.exit(0)
  }

  const snapshot = { ...original }

  await admin
    .from('email_captures')
    .update({
      drip_step_1_sent_at: daysAgoIso(4),
      drip_step_2_sent_at: null,
      drip_step_3_sent_at: null,
    })
    .eq('email', original.email)
    .eq('source', original.source)

  console.log('Backdated step 1 → 4 days ago; cleared steps 2/3')
  await sendDripStep(original, 2)
  console.log('✅ Drip step 2 sent')

  const afterStep2 = await fetchCapture()
  if (!afterStep2.drip_step_2_sent_at) {
    throw new Error('drip_step_2_sent_at not set after step 2 send')
  }
  console.log(`   drip_step_2_sent_at = ${afterStep2.drip_step_2_sent_at}`)

  await admin
    .from('email_captures')
    .update({ drip_step_1_sent_at: daysAgoIso(8) })
    .eq('email', original.email)
    .eq('source', original.source)

  await sendDripStep(original, 3)
  console.log('✅ Drip step 3 sent')

  const afterStep3 = await fetchCapture()
  if (!afterStep3.drip_step_3_sent_at) {
    throw new Error('drip_step_3_sent_at not set after step 3 send')
  }
  console.log(`   drip_step_3_sent_at = ${afterStep3.drip_step_3_sent_at}`)

  if (!keepBackdate) {
    await admin
      .from('email_captures')
      .update({
        drip_step_1_sent_at: snapshot.drip_step_1_sent_at,
        drip_step_2_sent_at: snapshot.drip_step_2_sent_at,
        drip_step_3_sent_at: snapshot.drip_step_3_sent_at,
      })
      .eq('email', original.email)
      .eq('source', original.source)
    console.log('\nRestored original drip timestamps')
  } else {
    console.log('\n--keep-backdate: left row at step 3 sent')
  }

  console.log('\n✅ Drip cron steps 2 and 3 verified')
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})

#!/usr/bin/env npx tsx
/**
 * Plan & Export staging money-path validation (Part 2).
 *
 * Usage (no dotenv -o — shell TEST_ENV wins; file must not carry PLAYWRIGHT_BASE_URL):
 *   npm run validate:plan-export-staging -- 2a
 *   npm run validate:plan-export-staging -- 2b
 *   npm run validate:plan-export-staging -- 2c
 */
import { createClient } from '@supabase/supabase-js'
import {
  assertStagingMoneyPathGuard,
  stagingMoneyPathBaseUrl,
} from './testEnv'

const step = process.argv[2] ?? 'help'
const consumerEmail =
  process.env.E2E_TIER1_EMAIL?.trim() ||
  process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL?.trim() ||
  'e2e-consumer@mywealthmaps.test'

function admin() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.test.staging')
  }
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

async function findUserId(email: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function latestPurchase(userId: string) {
  const { data, error } = await admin()
    .from('one_time_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('sku', 'plan_and_export')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function assertPurchaseWindow(row: NonNullable<Awaited<ReturnType<typeof latestPurchase>>>) {
  if (row.status !== 'completed') throw new Error(`Expected status=completed, got ${row.status}`)
  const purchased = new Date(row.purchased_at)
  const ends = new Date(row.edit_window_ends_at)
  const diffDays = Math.round((ends.getTime() - purchased.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays !== 90) {
    throw new Error(`Expected 90-day window, got ${diffDays} days`)
  }
  console.log('PASS purchase row:', {
    user_id: row.user_id,
    status: row.status,
    purchased_at: row.purchased_at,
    edit_window_ends_at: row.edit_window_ends_at,
    stripe_checkout_session_id: row.stripe_checkout_session_id,
    credit_applied_at: row.credit_applied_at,
  })
}

async function step2a() {
  const userId = await findUserId(consumerEmail)
  if (!userId) throw new Error(`User not found: ${consumerEmail}`)
  const row = await latestPurchase(userId)
  if (!row) throw new Error('No one_time_purchases row found')
  await assertPurchaseWindow(row)
  const { count, error } = await admin()
    .from('one_time_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('stripe_checkout_session_id', row.stripe_checkout_session_id)
  if (error) throw error
  if (count !== 1) throw new Error(`Expected exactly 1 row for session, got ${count}`)
  console.log('PASS idempotency index: one row per stripe_checkout_session_id')
}

async function step2b() {
  const userId = await findUserId(consumerEmail)
  if (!userId) throw new Error(`User not found: ${consumerEmail}`)
  const row = await latestPurchase(userId)
  if (!row?.credit_applied_at) {
    throw new Error('credit_applied_at is NULL — credit-on-subscribe did not run')
  }
  console.log('PASS credit_applied_at set:', row.credit_applied_at)
}

async function step2c() {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) throw new Error('CRON_SECRET required in .env.test.staging for 2c')
  const base = stagingMoneyPathBaseUrl()
  const userId = await findUserId(consumerEmail)
  if (!userId) throw new Error(`User not found: ${consumerEmail}`)

  const ends = new Date()
  ends.setUTCDate(ends.getUTCDate() + 13)
  const sessionId = `e2e_warn_14d_${Date.now()}`
  const purchased = new Date()
  purchased.setUTCDate(purchased.getUTCDate() - 77)

  await admin().from('one_time_purchases').delete().eq('stripe_checkout_session_id', sessionId)
  const { error: insertError } = await admin().from('one_time_purchases').insert({
    user_id: userId,
    sku: 'plan_and_export',
    stripe_checkout_session_id: sessionId,
    amount_cents: 149000,
    currency: 'usd',
    status: 'completed',
    purchased_at: purchased.toISOString(),
    edit_window_ends_at: ends.toISOString(),
    warning_14d_sent_at: null,
    warning_3d_sent_at: null,
  })
  if (insertError) throw insertError

  async function runCron() {
    const res = await fetch(`${base}/api/cron/plan-export-warnings`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Cron failed: ${res.status} ${JSON.stringify(json)}`)
    return json as { sent14d?: number }
  }

  const first = await runCron()
  const rowAfterFirst = await latestPurchase(userId)
  const second = await runCron()

  console.log('cron run 1:', first)
  console.log('cron run 2:', second)
  if (!rowAfterFirst?.warning_14d_sent_at) {
    throw new Error('warning_14d_sent_at not set after first cron run')
  }
  const rowAfterSecond = await latestPurchase(userId)
  if (rowAfterSecond?.warning_14d_sent_at !== rowAfterFirst.warning_14d_sent_at) {
    throw new Error('warning_14d_sent_at changed on second run — not idempotent')
  }
  if ((second.sent14d ?? 0) > 0) {
    throw new Error('Second cron run sent another 14d email')
  }
  console.log('PASS 2c: 14-day warning idempotent across two cron runs')

  await admin().from('one_time_purchases').delete().eq('stripe_checkout_session_id', sessionId)
}

async function main() {
  assertStagingMoneyPathGuard()

  switch (step) {
    case '2a':
      await step2a()
      break
    case '2b':
      await step2b()
      break
    case '2c':
      await step2c()
      break
    default:
      console.log(`Plan & Export staging validation

Run via: npm run validate:plan-export-staging -- 2a|2b|2c

Steps:
  2a  Assert latest purchase row + 90-day window + session idempotency
  2b  Assert credit_applied_at set after subscribe-after-purchase
  2c  Backdate purchase, run cron twice, assert single 14d warning

Complete a real test-card checkout through the CTA first, then run 2a/2b.`)
  }
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
})

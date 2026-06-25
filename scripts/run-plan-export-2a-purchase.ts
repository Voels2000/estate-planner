#!/usr/bin/env npx tsx
/**
 * 2A launch blocker: real test-card purchase on staging → webhook → one_time_purchases row.
 * Run: npm run validate:plan-export-staging:purchase
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { assertStagingMoneyPathGuard, stagingMoneyPathBaseUrl } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'

const EMAIL = E2E_IDENTITIES.consumer.email
const PASSWORD = E2E_IDENTITIES.consumer.password
const WINDOW_DAYS = 90

function admin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function findUserId() {
  const { data, error } = await admin().from('profiles').select('id').eq('email', EMAIL).maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error(`User not found: ${EMAIL}`)
  return data.id
}

async function snapshotProfile(userId: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select('consumer_tier, subscription_status, subscription_plan, stripe_customer_id')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

async function prepareUser(userId: string) {
  await admin()
    .from('one_time_purchases')
    .delete()
    .eq('user_id', userId)
    .eq('sku', 'plan_and_export')

  const { error } = await admin()
    .from('profiles')
    .update({
      consumer_tier: 1,
      subscription_status: 'none',
      subscription_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

async function restoreProfile(userId: string, snapshot: Awaited<ReturnType<typeof snapshotProfile>>) {
  const { error } = await admin()
    .from('profiles')
    .update({
      consumer_tier: snapshot.consumer_tier,
      subscription_status: snapshot.subscription_status,
      subscription_plan: snapshot.subscription_plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
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

async function waitForPurchaseRow(userId: string, timeoutMs = 45_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const row = await latestPurchase(userId)
    if (row?.status === 'completed') return row
    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

async function fillStripeCheckout(page: import('playwright').Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })
  await page.waitForTimeout(2000)

  const enterManual = page.getByRole('button', { name: /enter address manually/i })
  if (await enterManual.isVisible().catch(() => false)) {
    await enterManual.click()
    await page.waitForTimeout(500)
  }

  const country = page.getByLabel(/^Country$/i)
  if (await country.isVisible().catch(() => false)) {
    await country.selectOption('US')
  }
  if (await page.getByRole('textbox', { name: /address line 1/i }).isVisible().catch(() => false)) {
    await page.getByRole('textbox', { name: /address line 1/i }).fill('123 Test Street')
    await page.getByRole('textbox', { name: /^City$/i }).fill('Seattle')
    await page.getByRole('textbox', { name: /ZIP|postal code/i }).fill('98101')
    await page.getByLabel(/^State$/i).selectOption('WA')
  }

  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242')
  await page.getByPlaceholder('MM / YY').fill('12 / 34')
  await page.getByPlaceholder('CVC').fill('123')
  await page.getByPlaceholder(/full name on card/i).fill('E2E Consumer')

  const saveInfo = page.getByRole('checkbox', { name: /save my information/i })
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck()
  }

  await page.getByRole('button', { name: /^Pay$/i }).click()
}

async function main() {
  await assertStagingMoneyPathGuard()
  const base = stagingMoneyPathBaseUrl()
  const userId = await findUserId()
  const profileSnapshot = await snapshotProfile(userId)

  console.log(`[2A] Preparing ${EMAIL} (${userId}) — tier-1, no sub, no purchase rows`)
  const { data: beforeProfile } = await admin()
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  console.log(`[2A] stripe_customer_id before: ${beforeProfile?.stripe_customer_id ?? 'null'}`)
  await prepareUser(userId)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: base })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.locator('input[id="email"]').fill(EMAIL)
    await page.locator('input[id="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })

    await page.goto('/print')
    await page.getByTestId('plan-and-export-cta').waitFor({ timeout: 20_000 })
    console.log('[2A] CTA visible on /print')

    const checkoutPromise = page.waitForResponse(
      (res) => res.url().includes('/api/stripe/checkout') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Buy Plan & Export/i }).click()
    const checkoutRes = await checkoutPromise
    if (!checkoutRes.ok()) {
      throw new Error(`Checkout API failed: ${checkoutRes.status()} ${await checkoutRes.text()}`)
    }
    console.log('[2A] Checkout session created — completing test card payment')

    await fillStripeCheckout(page)

    // Poll DB first — fulfillment is the binary signal; redirect can lag
    let row = await waitForPurchaseRow(userId, 60_000)
    if (!row) {
      await page.waitForURL(/estate-planner-staging\.vercel\.app/, { timeout: 30_000 }).catch(() => {})
      row = await waitForPurchaseRow(userId, 15_000)
    }

    if (!row) {
      console.error(
        '[2A] FAIL — No one_time_purchases row after payment attempt.',
      )
      console.error(
        '[2A] If Stripe shows payment succeeded: check webhook logs + captureStripeWebhookFailure in Sentry — NOT the CTA.',
      )
      console.error('[2A] Last URL:', page.url())
      process.exitCode = 1
      return
    }

    const purchased = new Date(row.purchased_at)
    const ends = new Date(row.edit_window_ends_at)
    const diffDays = Math.round((ends.getTime() - purchased.getTime()) / (24 * 60 * 60 * 1000))

    console.log('[2A] PASS — row landed:', {
      user_id: row.user_id,
      status: row.status,
      purchased_at: row.purchased_at,
      edit_window_ends_at: row.edit_window_ends_at,
      window_days: diffDays,
      stripe_checkout_session_id: row.stripe_checkout_session_id,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
    })

    if (diffDays !== WINDOW_DAYS) {
      console.error(`[2A] FAIL — expected ${WINDOW_DAYS}-day window, got ${diffDays}`)
      process.exitCode = 1
      return
    }

    await page.goto('/print')
    const ready = page.getByTestId('deliverable-export-ready')
    const gated = page.getByTestId('deliverable-export-gated')
    if (await ready.isVisible().catch(() => false)) {
      console.log('[2A] PASS — /print shows deliverable-export-ready (unlocked)')
    } else if (await gated.isVisible().catch(() => false)) {
      console.error('[2A] FAIL — /print still gated after purchase row exists')
      process.exitCode = 1
    } else {
      console.log('[2A] WARN — /print state unclear; row exists (fulfillment proven)')
    }
  } finally {
    await browser.close()
    await restoreProfile(userId, profileSnapshot)
    console.log('[2A] Restored e2e-consumer profile snapshot')
  }
}

main().catch((err) => {
  console.error('[2A] ERROR:', err instanceof Error ? err.message : err)
  process.exit(1)
})

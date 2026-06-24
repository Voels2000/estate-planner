#!/usr/bin/env npx tsx
/**
 * 2B: subscribe after Plan & Export purchase → credit_applied_at once → resubscribe = no second credit.
 * Prereq: completed purchase row (2A). Stripe webhook must subscribe to customer.subscription.created.
 *
 * Run: npm run validate:plan-export-staging:subscribe
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { assertStagingMoneyPathGuard, stagingMoneyPathBaseUrl } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { fillStripeHostedCheckout } from './stripe-hosted-checkout-fill'

const EMAIL = E2E_IDENTITIES.consumer.email
const PASSWORD = E2E_IDENTITIES.consumer.password

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

async function latestPurchase(userId: string) {
  const { data, error } = await admin()
    .from('one_time_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('sku', 'plan_and_export')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function waitForCreditApplied(userId: string, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const row = await latestPurchase(userId)
    if (row?.credit_applied_at) return row
    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

async function prepareForSubscribe(userId: string, opts?: { resetCredit?: boolean }) {
  const purchase = await latestPurchase(userId)
  if (!purchase) {
    throw new Error('No completed plan_and_export purchase — run 2A purchase first')
  }
  if (opts?.resetCredit && purchase.credit_applied_at) {
    await admin()
      .from('one_time_purchases')
      .update({ credit_applied_at: null })
      .eq('id', purchase.id)
  }

  const { error } = await admin()
    .from('profiles')
    .update({
      consumer_tier: 1,
      subscription_status: 'none',
      subscription_plan: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

async function login(page: import('playwright').Page, base: string) {
  await page.goto('/login')
  await page.locator('input[id="email"]').fill(EMAIL)
  await page.locator('input[id="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
  console.log('[2B] Signed in at', base)
}

async function cancelActiveSubscription(page: import('playwright').Page, userId: string) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  const { data: profile } = await admin()
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (stripeKey && profile?.stripe_subscription_id) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id)
      console.log('[2B] Canceled Stripe subscription immediately:', profile.stripe_subscription_id)
      await new Promise((r) => setTimeout(r, 5000))
      return
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined
      if (code !== 'resource_missing') throw err
      console.warn('[2B] Local STRIPE_SECRET_KEY cannot see staging subscription — using cancel API')
    }
  }

  const res = await page.request.post('/api/stripe/cancel')
  if (!res.ok()) {
    console.warn('[2B] Cancel API:', res.status(), await res.text())
  } else {
    console.log('[2B] Cancel API accepted (cancel_at_period_end) — set STRIPE_SECRET_KEY for immediate cancel')
  }
}

async function subscribeFinancialMonthly(page: import('playwright').Page) {
  await page.goto('/billing')
  await page.getByRole('heading', { name: /Choose your plan/i }).waitFor({ timeout: 20_000 })

  const checkoutPromise = page.waitForResponse(
    (res) => res.url().includes('/api/stripe/checkout') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Get started$/i }).first().click()
  const checkoutRes = await checkoutPromise

  if (checkoutRes.status() === 409) {
    throw new Error('Subscribe blocked (409) — profile still shows active subscription')
  }
  if (!checkoutRes.ok()) {
    throw new Error(`Checkout API failed: ${checkoutRes.status()} ${await checkoutRes.text()}`)
  }

  const body = checkoutRes.request().postDataJSON() as Record<string, unknown>
  if (body.tier !== 1 || body.period !== 'monthly') {
    throw new Error(`Unexpected checkout body: ${JSON.stringify(body)}`)
  }

  console.log('[2B] Subscription checkout session created — completing test card payment')
  await fillStripeHostedCheckout(page)
  await page.waitForURL(/estate-planner-staging\.vercel\.app/, { timeout: 60_000 }).catch(() => {})
}

async function main() {
  assertStagingMoneyPathGuard()
  const base = stagingMoneyPathBaseUrl()
  const userId = await findUserId()

  console.log(`[2B] Preparing ${EMAIL} — purchase row required, subscription cleared for subscribe`)
  await prepareForSubscribe(userId)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: base })
  const page = await context.newPage()

  try {
    await login(page, base)

    console.log('[2B] First subscribe (expect credit_applied_at set once)')
    await subscribeFinancialMonthly(page)

    const rowAfterFirst = await waitForCreditApplied(userId, 90_000)
    if (!rowAfterFirst?.credit_applied_at) {
      console.error('[2B] FAIL — credit_applied_at still NULL after first subscribe')
      console.error('[2B] Confirm customer.subscription.created is on the Stripe webhook endpoint')
      process.exitCode = 1
      return
    }
    const creditOnce = rowAfterFirst.credit_applied_at
    console.log('[2B] PASS — credit_applied_at after first subscribe:', creditOnce)

    console.log('[2B] Second subscribe (expect credit_applied_at unchanged)')
    await cancelActiveSubscription(page, userId)
    await prepareForSubscribe(userId)
    await subscribeFinancialMonthly(page)
    await page.waitForTimeout(10_000)

    const rowAfterSecond = await latestPurchase(userId)
    if (!rowAfterSecond?.credit_applied_at) {
      console.error('[2B] FAIL — credit_applied_at cleared on second subscribe')
      process.exitCode = 1
      return
    }
    if (rowAfterSecond.credit_applied_at !== creditOnce) {
      console.error('[2B] FAIL — credit applied twice:', { first: creditOnce, second: rowAfterSecond.credit_applied_at })
      process.exitCode = 1
      return
    }

    console.log('[2B] PASS — credit_applied_at unchanged after resubscribe:', rowAfterSecond.credit_applied_at)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('[2B] ERROR:', err instanceof Error ? err.message : err)
  process.exit(1)
})

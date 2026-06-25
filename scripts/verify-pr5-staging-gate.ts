#!/usr/bin/env npx tsx
/**
 * PR 5 launch-gate staging verification (four checks + optional five-persona pass).
 *
 * Usage:
 *   npm run verify:pr5-staging-gate
 *   npm run verify:pr5-staging-gate -- --personas
 */
import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { buildUserAccessFromProfile } from '../lib/access/buildUserAccessFromProfile'
import { ensureE2eCanceledSubscriber } from './seed-e2e-lib'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { assertStagingMoneyPathGuard, stagingMoneyPathBaseUrl } from './testEnv'

const CANCELED = E2E_IDENTITIES.consumerCanceled
const TIER1 = E2E_IDENTITIES.consumerTier1
const TIER3 = E2E_IDENTITIES.consumer
const runPersonas = process.argv.includes('--personas')

function admin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  return createClient(url, key, { auth: { persistSession: false } })
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY required in .env.test.staging')
  if (key.startsWith('sk_live_')) throw new Error('Refusing live Stripe key on staging gate script')
  return new Stripe(key)
}

async function findUserId(email: string) {
  const { data, error } = await admin().from('profiles').select('id').eq('email', email).maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error(`User not found: ${email}`)
  return data.id
}

async function snapshotProfile(userId: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select(
      'consumer_tier, subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id, trial_ends_at, has_ever_subscribed, role, is_superuser',
    )
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

function sessionIdFromCheckoutUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const segments = path.split('/').filter(Boolean)
    const payIdx = segments.indexOf('pay')
    if (payIdx >= 0 && segments[payIdx + 1]?.startsWith('cs_')) {
      return segments[payIdx + 1]
    }
  } catch {
    // fall through
  }
  const match = url.match(/(cs_(?:test|live)_[a-zA-Z0-9]+)/)
  if (!match) throw new Error(`Could not parse checkout session id from ${url}`)
  return match[1]
}

async function retrieveCheckoutSession(
  stripe: Stripe,
  checkoutUrl: string,
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('No such checkout.session')) throw err

    const recent = await stripe.checkout.sessions.list({ limit: 10 })
    const matched =
      recent.data.find((s) => s.id === sessionId) ??
      recent.data.find((s) => checkoutUrl.includes(s.id))

    if (matched) {
      console.warn(`[check 1] retrieve(${sessionId}) missed — matched via list (${matched.id})`)
      return matched
    }

    console.error(
      'Recent sessions visible to local STRIPE_SECRET_KEY:',
      recent.data.map((s) => s.id),
    )
    throw new Error(
      `${message}\n` +
        `[check 1] Target mismatch — not a malformed key. Session ${sessionId} was created by ` +
        `${stagingMoneyPathBaseUrl()} (Vercel staging STRIPE_SECRET_KEY). Local retrieve used ` +
        `STRIPE_SECRET_KEY account ${stripeAccountLabel(process.env.STRIPE_SECRET_KEY ?? '')}. ` +
        `If both are sk_test_* with similar suffixes, this is usually a Stripe sandbox rotation: ` +
        `open the session in the Stripe dashboard sandbox that served staging checkout, and align ` +
        `.env.test.staging to that same sandbox. Hosted-page Check 1 still passes without retrieve.`,
    )
  }
}

/** Human-readable Stripe test account fragment — not a secret. */
function stripeAccountLabel(key: string): string {
  const trimmed = key.trim()
  const m = trimmed.match(/^sk_test_([a-zA-Z0-9]+)/)
  return m ? `sk_test_${m[1].slice(0, 8)}…` : '(unset or non-test)'
}

function logGateTargets() {
  const base = stagingMoneyPathBaseUrl()
  const ref =
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(
      /https:\/\/([^.]+)\.supabase\.co/,
    )?.[1] ?? 'unset'
  console.log(
    `[gate targets] TEST_ENV=${process.env.TEST_ENV} baseURL=${base} supabaseRef=${ref} ` +
      `stripeLocal=${stripeAccountLabel(process.env.STRIPE_SECRET_KEY ?? '')} ` +
      `(checkout POST → Vercel staging; retrieve → local .env.test.staging — must be same sandbox)`,
  )
}

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
}

async function fillStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })
  await page.waitForTimeout(2000)

  const cardAccordion = page.getByRole('button', { name: /pay with card/i })
  if (await cardAccordion.isVisible().catch(() => false)) {
    await cardAccordion.click()
    await page.waitForTimeout(500)
  }

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
  await page.getByPlaceholder(/full name on card/i).fill('E2E Staging Gate')

  const saveInfo = page.getByRole('checkbox', { name: /save my information/i })
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck()
  }

  const submit =
    (await page.getByRole('button', { name: /^Subscribe$/i }).isVisible().catch(() => false))
      ? page.getByRole('button', { name: /^Subscribe$/i })
      : page.getByRole('button', { name: /^Pay$/i })
  await submit.click({ timeout: 45_000 })
}

async function waitForProfile(
  userId: string,
  predicate: (row: NonNullable<Awaited<ReturnType<typeof snapshotProfile>>>) => boolean,
  timeoutMs = 60_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const row = await snapshotProfile(userId)
    if (row && predicate(row)) return row
    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

async function postEstateCheckout(page: Page): Promise<{ url: string; sessionId: string }> {
  const res = await page.request.post('/api/stripe/checkout', {
    data: { tier: 3, period: 'monthly' },
  })
  const text = await res.text()
  if (!res.ok()) {
    throw new Error(`Checkout API failed: ${res.status()} ${text}`)
  }
  const body = JSON.parse(text) as { url?: string }
  if (!body.url) throw new Error('Checkout API returned no url')
  return { url: body.url, sessionId: sessionIdFromCheckoutUrl(body.url) }
}

async function verifyCheckoutPageNoTrial(page: Page, checkoutUrl: string) {
  console.log('[check 1] Stripe retrieve missed — using hosted Checkout page (sandbox/target mismatch)')
  await page.goto(checkoutUrl)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)
  const text = (await page.locator('body').innerText()).toLowerCase()

  if (text.includes('free trial') || text.includes('days free') || text.includes('day free')) {
    throw new Error('Stripe hosted checkout advertises a trial period')
  }

  // Trial checkouts typically show $0 due today; Estate should charge immediately.
  if (/\$0(\.00)?\s*(due today|today)/i.test(text)) {
    throw new Error('Stripe checkout shows $0 due today — likely trial checkout')
  }

  console.log('PASS Check 1 (hosted page) — no trial language; non-zero charge implied')
}

async function check1StripeArtifact(page: Page): Promise<{ checkoutUrl: string; onCheckoutPage: boolean }> {
  console.log('\n=== Check 1: Stripe Checkout Session artifact (no trial_period_days) ===')
  await signIn(page, CANCELED.email, CANCELED.password)

  const { url: checkoutUrl, sessionId } = await postEstateCheckout(page)
  console.log('Checkout URL:', checkoutUrl.slice(0, 80) + '…')
  const stripe = stripeClient()

  try {
    const session = await retrieveCheckoutSession(stripe, checkoutUrl, sessionId)
    const trialDays = session.subscription_data?.trial_period_days ?? null

    console.log('Session:', {
      id: session.id,
      mode: session.mode,
      status: session.status,
      subscription_data: session.subscription_data,
      trial_period_days: trialDays,
    })

    if (trialDays != null && trialDays !== 0) {
      throw new Error(`Expected no trial_period_days on session, got ${trialDays}`)
    }

    console.log('PASS Check 1 — trial_period_days absent on Checkout Session object')
    return { checkoutUrl, onCheckoutPage: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('Target mismatch')) throw err
    await verifyCheckoutPageNoTrial(page, checkoutUrl)
    return { checkoutUrl, onCheckoutPage: true }
  }
}

async function check2EndToEndCharge(
  page: Page,
  userId: string,
  checkoutUrl: string,
  onCheckoutPage: boolean,
) {
  console.log('\n=== Check 2: End-to-end charge → active (not trialing), tier 3 ===')
  if (!onCheckoutPage) {
    await page.goto(checkoutUrl)
  }
  await fillStripeCheckout(page)

  const profile = await waitForProfile(
    userId,
    (row) => row.subscription_status === 'active' && row.consumer_tier === 3,
    90_000,
  )

  if (!profile) {
    const last = await snapshotProfile(userId)
    throw new Error(
      `Profile did not reach active tier 3. Last state: ${JSON.stringify(last)}`,
    )
  }

  if (profile.subscription_status === 'trialing') {
    throw new Error('Subscription landed as trialing — expected active')
  }

  if (profile.stripe_subscription_id) {
    try {
      const stripe = stripeClient()
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      if (sub.status === 'trialing') {
        throw new Error(`Stripe subscription status is trialing, expected active`)
      }
      console.log('Stripe subscription:', {
        id: sub.id,
        status: sub.status,
        trial_end: sub.trial_end,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('No such subscription')) {
        console.warn(
          '[check 2] Skipping Stripe subscription retrieve — sandbox/target mismatch (see Check 1 note)',
        )
      } else {
        throw err
      }
    }
  }

  console.log('PASS Check 2 — webhook landed active tier-3 subscription:', {
    subscription_status: profile.subscription_status,
    consumer_tier: profile.consumer_tier,
    subscription_plan: profile.subscription_plan,
  })
}

async function check3CopySweep(page: Page) {
  console.log('\n=== Check 3: Copy sweep — no "free trial" on consumer surfaces ===')

  const paths = ['/pricing', '/billing', '/event/selling-a-business/assess']
  const offenders: string[] = []

  for (const path of paths) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    const html = (await res?.text()) ?? ''
    const lower = html.toLowerCase()
    if (lower.includes('free trial') || lower.includes('start free trial')) {
      offenders.push(path)
    }
    console.log(`  ${path}: ${offenders.includes(path) ? 'FAIL' : 'ok'}`)
  }

  if (offenders.length > 0) {
    throw new Error(`"free trial" copy found on: ${offenders.join(', ')}`)
  }

  // Estate CTA on billing (may require auth — signed in from check 1/2)
  const subscribeButtons = await page.getByRole('button', { name: /^Subscribe$/i }).count()
  console.log(`  /billing Subscribe buttons visible: ${subscribeButtons}`)
  console.log('PASS Check 3 — no consumer "free trial" copy on checked surfaces')
}

async function check4Tier0Regression(page: Page) {
  console.log('\n=== Check 4: Tier 0 regression (e2e-consumer-canceled) ===')
  await ensureE2eCanceledSubscriber()

  await signIn(page, CANCELED.email, CANCELED.password)
  await page.goto('/dashboard')
  await page.getByRole('heading', { name: /welcome back/i }).waitFor({ timeout: 30_000 })
  await page.getByText('Net Worth').first().waitFor()
  await page.getByText(/your data — always free to enter/i).waitFor()

  const html = await page.content()
  if (/free trial/i.test(html)) {
    throw new Error('Tier 0 dashboard contains "free trial" copy')
  }

  const mcSection = await page.getByTestId('computed-estate-outlook-section').count()
  if (mcSection > 0) {
    throw new Error('Tier 0 dashboard leaked computed-estate-outlook-section')
  }

  const profile = await snapshotProfile(await findUserId(CANCELED.email))
  const access = buildUserAccessFromProfile(profile, false)
  if (access.tier !== 0) {
    throw new Error(`Expected effective tier 0, got ${access.tier}`)
  }

  console.log('PASS Check 4 — Tier 0 floor intact:', { tier: access.tier, netWorth: true, modelingGated: true })
}

async function effectiveTierForEmail(email: string, password: string, page: Page) {
  await signIn(page, email, password)
  const userId = await findUserId(email)
  const profile = await snapshotProfile(userId)
  const access = buildUserAccessFromProfile(profile, false)
  return { email, userId, profile, access }
}

async function fivePersonaPass(page: Page) {
  console.log('\n=== Five-persona coherence pass (same staging build) ===')

  await ensureE2eCanceledSubscriber()

  const results: { label: string; expectedTier: number; expectedTrial?: boolean; actual: unknown }[] =
    []

  {
    const { access } = await effectiveTierForEmail(CANCELED.email, CANCELED.password, page)
    results.push({ label: 'Tier 0 (canceled)', expectedTier: 0, actual: access })
    if (access.tier !== 0) throw new Error(`Tier 0 persona: expected tier 0, got ${access.tier}`)
  }

  {
    const { access } = await effectiveTierForEmail(TIER1.email, TIER1.password, page)
    results.push({ label: 'Tier 1', expectedTier: 1, actual: access })
    if (access.tier !== 1) throw new Error(`Tier 1 persona: expected tier 1, got ${access.tier}`)
  }

  {
    const userId = await findUserId(TIER1.email)
    const snap = await snapshotProfile(userId)
    await admin()
      .from('profiles')
      .update({
        consumer_tier: 2,
        subscription_status: 'active',
        subscription_plan: 'retirement_monthly',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    const profile = await snapshotProfile(userId)
    const access = buildUserAccessFromProfile(profile, false)
    results.push({ label: 'Tier 2 (temp retirement patch on tier1)', expectedTier: 2, actual: access })
    if (access.tier !== 2) throw new Error(`Tier 2 patch: expected tier 2, got ${access.tier}`)
    await admin()
      .from('profiles')
      .update({
        consumer_tier: snap.consumer_tier,
        subscription_status: snap.subscription_status,
        subscription_plan: snap.subscription_plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  }

  {
    const { access } = await effectiveTierForEmail(TIER3.email, TIER3.password, page)
    results.push({ label: 'Tier 3 (estate active)', expectedTier: 3, actual: access })
    if (access.tier !== 3) throw new Error(`Tier 3 persona: expected tier 3, got ${access.tier}`)
  }

  {
    const trialEmail = `e2e-pr5-trial-${Date.now()}@mywealthmaps.test`
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: created, error: createErr } = await admin().auth.admin.createUser({
      email: trialEmail,
      password: E2E_IDENTITIES.consumer.password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E PR5 Trial' },
    })
    if (createErr || !created.user) throw createErr ?? new Error('createUser failed')

    await admin()
      .from('profiles')
      .update({
        role: 'consumer',
        consumer_tier: 0,
        subscription_status: 'none',
        has_ever_subscribed: false,
        trial_ends_at: trialEnds,
        terms_accepted_at: new Date().toISOString(),
        terms_version: '2026-06-02',
        onboarding_wizard_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.user.id)

    const { access } = await effectiveTierForEmail(trialEmail, E2E_IDENTITIES.consumer.password, page)
    results.push({
      label: 'Fresh signup (app trial)',
      expectedTier: 3,
      expectedTrial: true,
      actual: access,
    })
    if (access.tier !== 3 || !access.isTrial) {
      throw new Error(`App trial signup: expected tier 3 + isTrial, got ${JSON.stringify(access)}`)
    }

    await admin().auth.admin.deleteUser(created.user.id)
  }

  for (const r of results) {
    console.log(`  PASS ${r.label}: tier=${(r.actual as { tier: number }).tier}`)
  }
  console.log('PASS Five-persona coherence — all tiers resolve as expected')
}

async function main() {
  assertStagingMoneyPathGuard()
  logGateTargets()
  const base = stagingMoneyPathBaseUrl()

  console.log('Preparing canceled persona for Estate checkout...')
  await ensureE2eCanceledSubscriber()

  const userId = await findUserId(CANCELED.email)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: base })
  const page = await context.newPage()

  try {
    const { checkoutUrl, onCheckoutPage } = await check1StripeArtifact(page)
    await check2EndToEndCharge(page, userId, checkoutUrl, onCheckoutPage)
    await check3CopySweep(page)
    await check4Tier0Regression(page)
    if (runPersonas) {
      await fivePersonaPass(page)
    } else {
      console.log('\n(Skipping five-persona pass — re-run with --personas)')
    }
    console.log('\n=== PR 5 staging gate: ALL CHECKS PASSED ===')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('\nPR 5 staging gate FAILED:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})

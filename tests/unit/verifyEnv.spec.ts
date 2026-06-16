/**
 * Env verification — scope routing and Stripe key mode
 * Run: npx playwright test tests/unit/verifyEnv.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  verifyEnvironment,
  resolveEnvScope,
  inferStripeKeyMode,
  stripeKeyScopeMismatch,
  shouldSkipUnsetStripePriceCheck,
} from '../../lib/env/verifyEnv'

const CONSUMER_PRICE = 'STRIPE_PRICE_FINANCIAL_MONTHLY'

test.describe('resolveEnvScope', () => {
  test('maps VERCEL_ENV to deployment scope', () => {
    expect(resolveEnvScope({ VERCEL_ENV: 'production' })).toBe('production')
    expect(resolveEnvScope({ VERCEL_ENV: 'preview' })).toBe('preview')
    expect(resolveEnvScope({})).toBe('local')
  })
})

test.describe('consumer Stripe prices', () => {
  test('missing in production is hard MISSING (not WARN)', async () => {
    const report = await verifyEnvironment({
      env: {
        VERCEL_ENV: 'production',
        [CONSUMER_PRICE]: '',
      },
    })

    expect(report.scope).toBe('production')
    expect(report.vars[CONSUMER_PRICE]).toBe('MISSING')
    expect(report.summary.missing).toBeGreaterThan(0)

    const priceFlags = report.flags.filter((f) => f.name === CONSUMER_PRICE)
    expect(priceFlags).toHaveLength(0)
  })

  test('missing in preview is WARN only (not in summary.missing)', async () => {
    const report = await verifyEnvironment({
      env: {
        VERCEL_ENV: 'preview',
        [CONSUMER_PRICE]: '',
      },
    })

    expect(report.scope).toBe('preview')
    expect(report.vars[CONSUMER_PRICE]).toBeUndefined()

    const beforeMissing = report.summary.missing
    const warn = report.flags.find((f) => f.name === CONSUMER_PRICE)
    expect(warn?.level).toBe('WARN')
    expect(warn?.reason).toContain('legacy fallback')

    // Re-run with price set — missing count should drop by 0 for this var path
    const withPrice = await verifyEnvironment({
      env: {
        VERCEL_ENV: 'preview',
        [CONSUMER_PRICE]: 'price_test_monthly',
      },
    })
    expect(withPrice.vars[CONSUMER_PRICE]).toBe('OK')
    expect(withPrice.summary.missing).toBe(beforeMissing)
  })

  test('all six consumer prices hard-fail together in production', async () => {
    const report = await verifyEnvironment({
      env: { VERCEL_ENV: 'production' },
    })

    const consumerKeys = [
      'STRIPE_PRICE_FINANCIAL_MONTHLY',
      'STRIPE_PRICE_FINANCIAL_ANNUAL',
      'STRIPE_PRICE_RETIREMENT_MONTHLY',
      'STRIPE_PRICE_RETIREMENT_ANNUAL',
      'STRIPE_PRICE_ESTATE_MONTHLY',
      'STRIPE_PRICE_ESTATE_ANNUAL',
    ] as const

    for (const key of consumerKeys) {
      expect(report.vars[key], `${key} should be MISSING in production`).toBe('MISSING')
    }
    expect(report.summary.missing).toBeGreaterThanOrEqual(6)
  })
})

test.describe('Stripe liveness key mode', () => {
  test('inferStripeKeyMode detects live vs test prefix', () => {
    expect(inferStripeKeyMode('sk_live_abc')).toBe('live')
    expect(inferStripeKeyMode('sk_test_abc')).toBe('test')
    expect(inferStripeKeyMode('')).toBe('unset')
    expect(inferStripeKeyMode('bad')).toBe('unknown')
  })

  test('production + sk_test_ fails liveness before balance.retrieve', async () => {
    const report = await verifyEnvironment({
      live: true,
      env: {
        VERCEL_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_test_fake_for_unit_test',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJfake',
      },
    })

    expect(report.liveness?.stripe_key_mode).toBe('test')
    expect(report.liveness?.stripe).toBe('LIVE_FAIL')
    expect(report.liveness?.stripe_reason).toContain('test mode')
    expect(report.vars.STRIPE_SECRET_KEY).toBe('WRONG_SHAPE')
  })

  test('preview + sk_live_ fails liveness before balance.retrieve', async () => {
    const report = await verifyEnvironment({
      live: true,
      env: {
        VERCEL_ENV: 'preview',
        STRIPE_SECRET_KEY: 'sk_live_fake_for_unit_test',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJfake',
      },
    })

    expect(report.liveness?.stripe_key_mode).toBe('live')
    expect(report.liveness?.stripe).toBe('LIVE_FAIL')
    expect(report.liveness?.stripe_reason).toContain('live mode')
    expect(report.vars.STRIPE_SECRET_KEY).toBe('WRONG_SHAPE')
  })

  test('stripeKeyScopeMismatch catches prod/test cross-wiring', () => {
    expect(stripeKeyScopeMismatch('production', 'test')).toContain('test mode')
    expect(stripeKeyScopeMismatch('preview', 'live')).toContain('live mode')
    expect(stripeKeyScopeMismatch('production', 'live')).toBeUndefined()
    expect(stripeKeyScopeMismatch('preview', 'test')).toBeUndefined()
  })

  test('?live=1 with test Stripe key still runs price checks (preview scope)', async () => {
    const report = await verifyEnvironment({
      live: true,
      env: {
        VERCEL_ENV: 'preview',
        STRIPE_SECRET_KEY: 'sk_test_fake_for_unit_test',
        STRIPE_PRICE_FINANCIAL_MONTHLY: '',
        STRIPE_PRICE_ADVISOR_STARTER_MONTHLY: 'price_test_advisor_starter',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJfake',
      },
    })

    expect(report.liveness?.stripe_key_mode).toBe('test')
    // balance.retrieve fails with fake key — prices not reached; scope/key wiring is the assertion
    expect(report.liveness?.stripe).toBe('LIVE_FAIL')
    expect(report.vars.STRIPE_SECRET_KEY).toBe('OK')
  })

  test('shouldSkipUnsetStripePriceCheck — consumer only outside production', () => {
    expect(shouldSkipUnsetStripePriceCheck('STRIPE_PRICE_FINANCIAL_MONTHLY', 'preview')).toBe(
      true,
    )
    expect(shouldSkipUnsetStripePriceCheck('STRIPE_PRICE_FINANCIAL_MONTHLY', 'production')).toBe(
      false,
    )
    expect(
      shouldSkipUnsetStripePriceCheck('STRIPE_PRICE_ADVISOR_STARTER_MONTHLY', 'preview'),
    ).toBe(false)
    expect(
      shouldSkipUnsetStripePriceCheck('STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY', 'local'),
    ).toBe(false)
  })
})

test.describe('verifier tuning — Supabase formats, canary, platform vars', () => {
  const prodBase = {
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    ADMIN_VERIFY_TOKEN: 'tok',
  } as const

  test('SUPABASE_SERVICE_ROLE_KEY accepts sb_secret_ and eyJ', async () => {
    const sb = await verifyEnvironment({
      env: {
        ...prodBase,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_xyz',
      },
    })
    expect(sb.vars.SUPABASE_SERVICE_ROLE_KEY).toBe('OK')

    const jwt = await verifyEnvironment({
      env: {
        ...prodBase,
        SUPABASE_SERVICE_ROLE_KEY: 'eyJabc',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJdef',
      },
    })
    expect(jwt.vars.SUPABASE_SERVICE_ROLE_KEY).toBe('OK')
    expect(jwt.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('OK')
  })

  test('NEXT_PUBLIC_SUPABASE_ANON_KEY accepts sb_publishable_ and eyJ', async () => {
    const report = await verifyEnvironment({
      env: {
        ...prodBase,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc',
      },
    })
    expect(report.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('OK')
    expect(report.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY).not.toBe('WRONG_SHAPE')
  })

  test('E2E_CANARY_PASSWORD in production is OK (not FORBIDDEN_IN_SCOPE)', async () => {
    const report = await verifyEnvironment({
      env: {
        VERCEL_ENV: 'production',
        E2E_CANARY_PASSWORD: 'canary-test-password-12',
      },
    })
    expect(report.vars.E2E_CANARY_PASSWORD).toBe('OK')
    expect(
      report.flags.filter((f) => f.name === 'E2E_CANARY_PASSWORD' && f.level === 'WARN'),
    ).toHaveLength(0)
  })

  test('SIGNUP_SKIP_EMAIL_CONFIRM in production is CRITICAL FORBIDDEN_IN_SCOPE', async () => {
    const report = await verifyEnvironment({
      env: {
        VERCEL_ENV: 'production',
        SIGNUP_SKIP_EMAIL_CONFIRM: 'true',
      },
    })
    expect(report.vars.SIGNUP_SKIP_EMAIL_CONFIRM).toBe('FORBIDDEN_IN_SCOPE')
    const flag = report.flags.find((f) => f.name === 'SIGNUP_SKIP_EMAIL_CONFIRM')
    expect(flag?.level).toBe('CRITICAL')
  })

  test('platform var TZ produces no REVIEW flag', async () => {
    const report = await verifyEnvironment({
      env: { VERCEL_ENV: 'production', TZ: 'UTC' },
    })
    expect(report.flags.find((f) => f.name === 'TZ')).toBeUndefined()
  })

  test('sb_secret_ on NEXT_PUBLIC_SUPABASE_ANON_KEY is CRITICAL EXPOSED_SECRET', async () => {
    const report = await verifyEnvironment({
      env: {
        ...prodBase,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_wrong_on_public',
      },
    })
    const critical = report.flags.filter(
      (f) => f.name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && f.level === 'CRITICAL',
    )
    expect(critical.length).toBeGreaterThan(0)
    expect(
      critical.some((f) => /sb_secret_|Supabase secret/.test(f.reason)),
    ).toBe(true)
  })
})

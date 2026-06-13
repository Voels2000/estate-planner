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
})

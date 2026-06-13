/**
 * Production consumer price fallback guard
 * Run: npx playwright test tests/unit/stripePricesProdGuard.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  CONSUMER_STRIPE_PRICE_ENV_VARS,
  ENV_MANIFEST,
} from '../../lib/env/manifest'
import {
  getPriceConfig,
  __resetStripePriceCachesForTests,
} from '../../lib/billing/stripePrices'

const LEGACY_ESTATE_MONTHLY = 'price_1TILGOCaljka9gJtCDLiKFHp'

test.describe('stripePrices production guard', () => {
  test.beforeEach(() => {
    __resetStripePriceCachesForTests()
  })

  test.afterEach(() => {
    delete process.env.VERCEL_ENV
    delete process.env.STRIPE_PRICE_ESTATE_MONTHLY
    delete process.env.STRIPE_PRICE_ESTATE_ANNUAL
    __resetStripePriceCachesForTests()
  })

  test('A: production + unset monthly throws naming env var (not fallback ID)', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.STRIPE_PRICE_ESTATE_MONTHLY = ''

    let message = ''
    try {
      getPriceConfig(3, 'monthly')
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }

    expect(message).toContain('STRIPE_PRICE_ESTATE_MONTHLY')
    expect(message).toContain('production')
    expect(message).not.toMatch(/price_1TIL/)
  })

  test('B: preview + unset monthly returns legacy fallback without throwing', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.STRIPE_PRICE_ESTATE_MONTHLY = ''

    const config = getPriceConfig(3, 'monthly')

    expect(config.priceId).toBe(LEGACY_ESTATE_MONTHLY)
  })

  test('C: production + env set returns env value', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.STRIPE_PRICE_ESTATE_MONTHLY = 'price_live_xyz'

    const config = getPriceConfig(3, 'monthly')

    expect(config.priceId).toBe('price_live_xyz')
  })

  test('D: production + unset annual throws naming annual env var', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.STRIPE_PRICE_ESTATE_ANNUAL = ''

    let message = ''
    try {
      getPriceConfig(3, 'annual')
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }

    expect(message).toContain('STRIPE_PRICE_ESTATE_ANNUAL')
    expect(message).toContain('production')
  })

  test('E: manifest parity — 6 consumer vars prod-required', () => {
    expect(CONSUMER_STRIPE_PRICE_ENV_VARS).toHaveLength(6)

    for (const name of CONSUMER_STRIPE_PRICE_ENV_VARS) {
      const entry = ENV_MANIFEST.find((e) => e.name === name)
      expect(entry, `${name} missing from ENV_MANIFEST`).toBeTruthy()
      expect(entry?.requiredInScopes).toContain('production')
    }
  })
})

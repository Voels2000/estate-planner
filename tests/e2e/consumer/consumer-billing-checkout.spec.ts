import { test, expect } from '@playwright/test'
import { firmStarterPriceIdForE2e } from '../helpers/billing-e2e'

/**
 * Consumer billing checkout API — auth via consumer-setup storage state.
 * Staging/local: e2e-consumer seed uses tier 3 + active subscription (409 duplicate guard).
 * Production smoke: canary-consumer is advisor-linked — blocks at 403 before duplicate guard.
 * Use tier + period in POST body so the server resolves price IDs from its env (not test-bundle IDs).
 */

test.describe('Consumer billing checkout API', () => {
  test('POST /api/stripe/checkout rejects unauthenticated requests', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await context.request.post('/api/stripe/checkout', {
      data: { tier: 1, period: 'monthly' },
    })
    expect(res.status()).toBe(401)
    await context.close()
  })

  test('POST /api/stripe/checkout blocks duplicate subscription', async ({ request }) => {
    test.skip(
      process.env.TEST_ENV === 'production',
      'Prod canary is advisor-linked; duplicate 409 covered on staging (self-serve subscribed consumer)',
    )
    const res = await request.post('/api/stripe/checkout', {
      data: { tier: 1, period: 'monthly' },
    })
    expect(res.status()).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('already_subscribed')
    expect(body.error).toMatch(/already have an active subscription/i)
  })

  test('POST /api/stripe/checkout rejects advisor firm price ids', async ({ request }) => {
    const priceId = firmStarterPriceIdForE2e()
    test.skip(!priceId, 'Set PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID in .env.test')
    const res = await request.post('/api/stripe/checkout', {
      data: { priceId },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/firm or attorney checkout/i)
  })

  test('POST /api/stripe/attorney-checkout forbidden for consumer session', async ({
    request,
  }) => {
    const res = await request.post('/api/stripe/attorney-checkout', {
      data: { planKey: 'starter' },
    })
    expect(res.status()).toBe(403)
  })

  test('POST /api/stripe/firm-checkout forbidden for consumer session', async ({ request }) => {
    const priceId = firmStarterPriceIdForE2e()
    test.skip(!priceId, 'Set PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID in .env.test')
    const res = await request.post('/api/stripe/firm-checkout', {
      data: { priceId, seatCount: 1 },
    })
    expect(res.status()).toBe(403)
  })
})

test.describe('@production', () => {
  test.describe('Consumer billing checkout API — prod canary', () => {
    /**
     * Confirmed: checkout route sets isAdvisorClient from advisor_clients (CONNECTED statuses)
     * and consumerCheckoutBlockReason returns advisor_client/advisor_managed at 403 before
     * the already_subscribed (409) path — linked prod canary never reaches duplicate guard.
     */
    test('POST /api/stripe/checkout blocks advisor-linked consumer self-serve checkout', async ({
      request,
    }) => {
      const res = await request.post('/api/stripe/checkout', {
        data: { tier: 1, period: 'monthly' },
      })
      expect(res.status()).toBe(403)
      const body = await res.json()
      expect(['advisor_client', 'advisor_managed']).toContain(body.code)
      expect(body.error).toMatch(/managed by your advisor/i)
    })
  })
})

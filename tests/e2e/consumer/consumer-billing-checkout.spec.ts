import { test, expect } from '@playwright/test'
import { firmStarterPriceIdForE2e } from '../helpers/billing-e2e'

/**
 * Consumer billing checkout API — auth via consumer-setup storage state.
 * E2E consumer seed uses tier 3 + active subscription (duplicate guard).
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
    const res = await request.post('/api/stripe/checkout', {
      data: { tier: 1, period: 'monthly' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
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

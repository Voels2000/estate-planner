import { test, expect } from '@playwright/test'
import { getPriceConfig } from '@/lib/billing/stripePrices'

/**
 * Tier-1 consumer can start checkout (no active subscription on seed account).
 * Runs only in consumer-tier1 project when PLAYWRIGHT_CONSUMER_TIER1_* is set.
 */
test.describe('Tier-1 consumer billing checkout', () => {
  test('POST /api/stripe/checkout returns Stripe checkout url', async ({ request }) => {
    const financial = getPriceConfig(1, 'monthly')
    const res = await request.post('/api/stripe/checkout', {
      data: { priceId: financial.priceId, period: 'monthly' },
    })

    if (res.status() === 409) {
      const body = await res.json()
      test.skip(
        body.code === 'already_subscribed',
        'Tier-1 account has active subscription — duplicate guard',
      )
      return
    }

    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com/)
  })
})

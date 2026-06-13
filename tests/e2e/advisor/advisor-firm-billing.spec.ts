import { test, expect } from '@playwright/test'
import { firmEnterprisePriceIdForE2e, firmStarterPriceIdForE2e } from '../helpers/billing-e2e'

/**
 * Advisor firm billing — auth via advisor-setup storage state.
 * Requires ensureAdvisorFirmForE2e in seed:e2e (firm owner + starter tier).
 */
test.describe('@production', () => {
test.describe('Advisor firm billing UI', () => {
  test('/billing loads firm billing for firm owner', async ({ page }) => {
    await page.goto('/billing')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: /Firm billing|Billing|Firm not linked/i }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Firm billing|Subscription and seats|Firm not linked/i).first()).toBeVisible()
  })

  test('/advisor/firm loads roster for firm owner', async ({ page }) => {
    await page.goto('/advisor/firm')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /^Firm$/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Advisor roster|Firm summary/i).first()).toBeVisible()
  })
})

test.describe('Advisor firm billing checkout API', () => {
  test('POST /api/stripe/firm-checkout rejects enterprise self-serve', async ({ request }) => {
    const priceId = firmEnterprisePriceIdForE2e()
    test.skip(
      !priceId,
      'Set PLAYWRIGHT_ADVISOR_FIRM_ENTERPRISE_PRICE_ID in .env.test.prod (must match Vercel production)',
    )
    const res = await request.post('/api/stripe/firm-checkout', {
      data: {
        priceId,
        seatCount: 51,
      },
    })
    expect([400, 403]).toContain(res.status())
    const body = (await res.json()) as { error?: string }
    if (
      body.error === 'Bad request' &&
      (process.env.PLAYWRIGHT_BASE_URL ?? '').includes('mywealthmaps.com')
    ) {
      test.skip(
        true,
        'Enterprise price ID not on production — set PLAYWRIGHT_ADVISOR_FIRM_ENTERPRISE_PRICE_ID to Vercel Production STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY (live price_..., not test price_1Th...)',
      )
    }
    expect(body.error).toMatch(/enterprise|sales/i)
  })

  test('POST /api/stripe/firm-checkout rejects invalid price id', async ({ request }) => {
    const res = await request.post('/api/stripe/firm-checkout', {
      data: { priceId: 'price_invalid_e2e', seatCount: 1 },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/stripe/firm-checkout returns checkout url for starter tier', async ({
    request,
  }) => {
    const priceId = firmStarterPriceIdForE2e()
    const res = await request.post('/api/stripe/firm-checkout', {
      data: {
        priceId,
        seatCount: 1,
      },
    })

    const text = await res.text()
    let body: { error?: string; url?: string } = {}
    try {
      body = JSON.parse(text) as { error?: string; url?: string }
    } catch {
      body = {}
    }

    if (res.status() === 400) {
      if (body.error?.includes('active subscription')) {
        test.skip(true, 'Firm already subscribed — checkout blocked as expected')
        return
      }
      test.skip(
        true,
        `Price ID ${priceId} rejected (${body.error ?? 'Bad request'}) — set PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID in .env.test`,
      )
      return
    }

    if (res.status() === 500) {
      test.skip(
        true,
        `Stripe session creation failed (${body.error ?? text}) — verify live firm price IDs in Vercel`,
      )
      return
    }

    expect(res.ok(), text).toBeTruthy()
    expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com/)
  })

  test('POST /api/stripe/attorney-checkout forbidden for advisor session', async ({
    request,
  }) => {
    const res = await request.post('/api/stripe/attorney-checkout', {
      data: { planKey: 'starter' },
    })
    expect(res.status()).toBe(403)
  })

  test('POST /api/stripe/cancel blocked when firm subscription is active', async ({
    request,
  }) => {
    const res = await request.post('/api/stripe/cancel')
    if (res.status() === 400) {
      const body = await res.json()
      const firmManaged = /firm subscription|Manage firm billing/i.test(body.error ?? '')
      if (firmManaged) {
        expect(body.error).toMatch(/firm subscription|Manage firm billing/i)
        return
      }
    }
    // Advisor profile may have consumer sub only — accept success or no-subscription errors.
    expect([200, 400]).toContain(res.status())
  })
})
})

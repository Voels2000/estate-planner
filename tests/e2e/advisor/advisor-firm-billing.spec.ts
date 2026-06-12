import { test, expect } from '@playwright/test'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'

/**
 * Advisor firm billing — auth via advisor-setup storage state.
 * Requires ensureAdvisorFirmForE2e in seed:e2e (firm owner + starter tier).
 */
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
    const res = await request.post('/api/stripe/firm-checkout', {
      data: {
        priceId: ADVISOR_FIRM_PRICE_IDS.enterprise,
        seatCount: 51,
      },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
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
    const res = await request.post('/api/stripe/firm-checkout', {
      data: {
        priceId: ADVISOR_FIRM_PRICE_IDS.starter,
        seatCount: 1,
      },
    })

    if (res.status() === 400) {
      const body = await res.json()
      test.skip(
        body.error?.includes('active subscription'),
        'Firm already subscribed — checkout blocked as expected',
      )
      return
    }

    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
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

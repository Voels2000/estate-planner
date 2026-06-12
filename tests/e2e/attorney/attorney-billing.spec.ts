import { test, expect } from '@playwright/test'

/**
 * Attorney billing — auth via attorney-setup storage state.
 */
test.describe('Attorney billing UI', () => {
  test('/attorney/billing loads plans page', async ({ page }) => {
    await page.goto('/attorney/billing')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /Attorney Plans/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Attorney Starter|Free/i).first()).toBeVisible()
  })

  test('subscribe button triggers attorney checkout API', async ({ page }) => {
    await page.goto('/attorney/billing')

    const checkoutResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/stripe/attorney-checkout') && res.request().method() === 'POST',
      { timeout: 20_000 },
    )

    await page.getByRole('button', { name: /Subscribe to Attorney/i }).first().click()

    const res = await checkoutResponse
    expect([200, 503]).toContain(res.status())

    if (res.status() === 200) {
      const body = await res.json()
      expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com/)
    } else {
      const body = await res.json()
      expect(body.error).toMatch(/not yet configured|contact support/i)
      await expect(page.getByText(/not yet configured|contact support|Checkout failed/i).first()).toBeVisible()
    }
  })
})

test.describe('Attorney billing checkout API', () => {
  test('POST /api/stripe/attorney-checkout rejects invalid plan', async ({ request }) => {
    const res = await request.post('/api/stripe/attorney-checkout', {
      data: { planKey: 'enterprise' },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/stripe/attorney-checkout accepts starter or returns 503 if unconfigured', async ({
    request,
  }) => {
    const res = await request.post('/api/stripe/attorney-checkout', {
      data: { planKey: 'starter' },
    })
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    if (res.status() === 200) {
      expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com/)
    } else {
      expect(body.error).toMatch(/not yet configured|contact support/i)
    }
  })

  test('POST /api/stripe/firm-checkout forbidden for attorney session', async ({ request }) => {
    const res = await request.post('/api/stripe/firm-checkout', {
      data: { priceId: 'price_1TIW5xCaljka9gJtTw9uF5E5', seatCount: 1 },
    })
    expect(res.status()).toBe(403)
  })
})

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

  test('subscribe button redirects to Stripe or shows checkout error', async ({ page }) => {
    await page.goto('/attorney/billing')

    await page.getByRole('button', { name: /Subscribe to Attorney/i }).first().click()

    const stripeNav = page
      .waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 })
      .then(() => 'stripe' as const)
      .catch(() => null)

    const errorVisible = page
      .getByText(/not yet configured|contact support|Checkout failed|Something went wrong/i)
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => 'error' as const)
      .catch(() => null)

    const outcome = await Promise.race([stripeNav, errorVisible])
    expect(outcome, 'Expected Stripe redirect or in-page checkout error').not.toBeNull()
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

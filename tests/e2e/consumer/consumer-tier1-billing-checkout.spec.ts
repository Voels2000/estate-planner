import { test, expect, type Page, type Response } from '@playwright/test'

/**
 * Tier-1 consumer billing — exercises the real /billing Subscribe button.
 * Runs only in consumer-tier1 project when PLAYWRIGHT_CONSUMER_TIER1_* is set.
 *
 * Regression guard: would fail if handleSubscribe reintroduces client-side priceId.
 */
test.describe('Tier-1 consumer billing checkout UI', () => {
  async function clickFinancialSubscribe(page: Page): Promise<Response> {
    const checkoutResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/stripe/checkout') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /^Get started$/i }).first().click()
    return checkoutResponse
  }

  function assertCheckoutRequestShape(res: Response, period: 'monthly' | 'annual') {
    const body = res.request().postDataJSON() as Record<string, unknown>
    expect(body, 'Subscribe must send tier/period, not client-resolved priceId').toMatchObject({
      tier: 1,
      period,
    })
    expect(body, 'Client must not POST priceId — server resolves live Stripe prices').not.toHaveProperty(
      'priceId',
    )
  }

  test('Financial monthly Subscribe sends tier/period and opens Stripe checkout', async ({
    page,
  }) => {
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: /Choose your plan/i })).toBeVisible()

    const res = await clickFinancialSubscribe(page)

    if (res.status() === 409) {
      test.skip(true, 'Tier-1 account already subscribed — duplicate guard')
    }

    expect(res.ok(), await res.text()).toBeTruthy()
    assertCheckoutRequestShape(res, 'monthly')

    const payload = (await res.json()) as { url?: string }
    expect(payload.url).toMatch(/^https:\/\/checkout\.stripe\.com/)

    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? ''
    if (baseURL.includes('mywealthmaps.com')) {
      expect(payload.url).toMatch(/cs_live_/)
    }

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 })
  })

  test('Financial annual Subscribe sends tier/period when annual toggle is available', async ({
    page,
  }) => {
    await page.goto('/billing')

    const toggle = page.getByRole('switch', { name: /Toggle annual billing/i })
    if (!(await toggle.isVisible())) {
      test.skip(true, 'Annual billing not configured on this deployment')
    }

    await toggle.click()
    await expect(page.getByText(/\$290|\$24/).first()).toBeVisible()

    const res = await clickFinancialSubscribe(page)

    if (res.status() === 409) {
      test.skip(true, 'Tier-1 account already subscribed — duplicate guard')
    }

    expect(res.ok(), await res.text()).toBeTruthy()
    assertCheckoutRequestShape(res, 'annual')

    const payload = (await res.json()) as { url?: string }
    expect(payload.url).toMatch(/^https:\/\/checkout\.stripe\.com/)
  })
})

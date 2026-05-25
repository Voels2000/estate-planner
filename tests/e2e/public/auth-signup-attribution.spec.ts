import { test, expect } from '@playwright/test'

/**
 * Nightly / manual: full signup attribution needs disposable email + PUBLIC_SIGNUP_OPEN.
 * This spec verifies sessionStorage contract on event pages without creating accounts.
 */
test.describe('Signup attribution session contract (acquisition §C–D)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('advisor ref stored in sessionStorage on event visit', async ({ page }) => {
    const ref = process.env.PLAYWRIGHT_ADVISOR_REFERRAL_CODE ?? 'e2e-test-ref'
    await page.goto(`/event/selling-a-business?ref=${ref}`)
    await page.waitForFunction(
      (code) => sessionStorage.getItem('mwm_referral_code') === code,
      ref,
      { timeout: 15_000 },
    )
  })

  test('attorney aref stored in sessionStorage on event visit', async ({ page }) => {
    const aref = process.env.PLAYWRIGHT_ATTORNEY_REFERRAL_CODE ?? 'e2eatt01'
    await page.goto(`/event/selling-a-business?aref=${aref}`)
    const stored = await page.evaluate(() =>
      sessionStorage.getItem('mwm_attorney_referral_code'),
    )
    expect(stored).toBe(aref)
  })

  test('signup page reachable when open signups enabled', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).not.toHaveURL(/404/)
    await expect(
      page.getByRole('heading', { name: /sign up|create|account/i }).or(
        page.getByLabel(/email/i),
      ).first(),
    ).toBeVisible({ timeout: 20_000 })
  })
})

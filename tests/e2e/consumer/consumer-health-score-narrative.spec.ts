import { test, expect } from '@playwright/test'

test.describe('Health score narrative', () => {
  test('dashboard shows estate readiness score when present', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByText(/Good (morning|afternoon|evening)|Estate/i).first(),
    ).toBeVisible({ timeout: 30_000 })

    await expect(
      page.getByText(/Estate readiness \d+\/100/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('my-estate-strategy page loads with horizons or upgrade banner', async ({ page }) => {
    await page.goto('/my-estate-strategy')
    await expect(
      page
        .getByText(/Estate value & tax horizons|Estate Value & Tax Horizons|Upgrade/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 })
  })
})

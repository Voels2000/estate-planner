import { test, expect } from '@playwright/test'

test.describe('Billing and subscription UI', () => {
  test('/billing loads for signed-in consumer', async ({ page }) => {
    await page.goto('/billing')
    await expect(page).not.toHaveURL(/404/)
    await expect(
      page
        .getByRole('heading', { name: /all set|Choose your plan|Billing/i })
        .first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('sidebar Manage Subscription navigates to billing', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: /Manage Subscription/i }).first().click()
    await expect(page).toHaveURL(/\/billing/)
  })
})

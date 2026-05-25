import { test, expect } from '@playwright/test'

test.describe('Estate health check UI (smoke §4)', () => {
  test('complete five questions and land on dashboard', async ({ page }) => {
    await page.goto('/health-check')
    await expect(page.getByText('Estate Health Check')).toBeVisible({ timeout: 20_000 })

    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /✓ Yes/i }).click()
      await page.waitForTimeout(350)
    }

    await page
      .getByRole('button', { name: /See My Estate Readiness Score/i })
      .click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 20_000 })
  })
})

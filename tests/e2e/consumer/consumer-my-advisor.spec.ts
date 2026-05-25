import { test, expect } from '@playwright/test'

test.describe('My Advisor connection UI', () => {
  test('/my-advisor loads connection workspace', async ({ page }) => {
    await page.goto('/my-advisor')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByRole('heading', { name: /advisor/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page
        .getByText(/connect|request|connected|invite/i)
        .first(),
    ).toBeVisible()
  })
})

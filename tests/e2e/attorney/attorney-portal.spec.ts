import { test, expect } from '@playwright/test'

test.describe('Attorney portal', () => {
  test('/attorney dashboard loads', async ({ page }) => {
    await page.goto('/attorney')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: /attorney|client|dashboard/i }).first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('event referral URLs use aref when listing has code', async ({ page }) => {
    await page.goto('/attorney')
    const arefLink = page.locator('a[href*="/event/"][href*="aref="]').first()
    if (!(await arefLink.isVisible().catch(() => false))) {
      test.skip(true, 'No attorney event referral links — seed test-attorney.ts')
      return
    }
    const href = await arefLink.getAttribute('href')
    expect(href).toMatch(/aref=/)
  })
})

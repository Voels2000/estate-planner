import { test, expect } from '@playwright/test'

test.describe('Attorney portal', () => {
  test('/attorney dashboard loads', async ({ page }) => {
    await page.goto('/attorney')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: /attorney|client|dashboard/i }).first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('marketing tab shows life-event link kit with aref URLs', async ({ page }) => {
    await page.goto('/attorney/marketing')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 30_000 })

    const copyButton = page.getByRole('button', { name: /^Copy$/ }).first()
    if (!(await copyButton.isVisible().catch(() => false))) {
      test.skip(true, 'No referral code on test attorney listing')
      return
    }
    await expect(page.getByText(/Life-event link kit/i)).toBeVisible()
    await expect(page.locator('text=?aref=')).toBeVisible()
  })
})

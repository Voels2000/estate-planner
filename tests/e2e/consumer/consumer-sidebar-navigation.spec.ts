import { test, expect } from '@playwright/test'

test.describe('Consumer sidebar layout (smoke §1.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('footer shows connection and billing links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /My Advisor/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Manage Subscription/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Education Guide/i }).first()).toBeVisible()
  })

  test('sidebar Manage Subscription navigates to billing', async ({ page }) => {
    await page.getByRole('link', { name: /Manage Subscription/i }).first().click()
    await expect(page).toHaveURL(/\/billing/)
  })

  test('overview nav has Profile and Estate Summary only', async ({ page }) => {
    const nav = page.locator('nav').first()
    await expect(nav.getByRole('link', { name: 'Profile' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Estate Summary' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Find an Advisor/i })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /Find an Attorney/i })).toHaveCount(0)
  })

  test('consumer account does not show professional portal links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Advisor Portal/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Attorney Portal/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Admin Portal/i })).toHaveCount(0)
  })
})

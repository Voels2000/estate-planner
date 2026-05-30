/**
 * Consumer RPC guard smoke — household-scoped pages load without 403.
 * Manual equivalent: e2e-consumer@mywealthmaps.test → /estate-tax, /gifting
 */
import { test, expect } from '@playwright/test'

test.describe('Security sprint — consumer RPC pages', () => {
  test('estate-tax loads with composition data', async ({ page }) => {
    await page.goto('/estate-tax')
    await expect(page.getByRole('heading', { name: /estate tax/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('body')).not.toContainText('Forbidden')
    await expect(page.getByText(/\$|Gross|Taxable|Estate/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('gifting tab loads via trust-strategy page', async ({ page }) => {
    await page.goto('/my-estate-trust-strategy?tab=gifting')
    await expect(page.getByRole('heading', { name: /trust|strategy|gifting/i }).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('body')).not.toContainText('Forbidden')
  })
})

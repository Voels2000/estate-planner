import { test, expect } from '@playwright/test'
import { assertNoUpgradeBanner } from '../helpers/page-assertions'

test.describe('Import data access (estate-tier fixture)', () => {
  test('/import shows importer for tier 2+ account', async ({ page }) => {
    await page.goto('/import')
    await expect(page.getByRole('heading', { name: /import/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await assertNoUpgradeBanner(page)
    await expect(
      page.getByText(/csv|xlsx|upload|drop|template/i).first(),
    ).toBeVisible()
  })
})

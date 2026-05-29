import { test, expect } from '@playwright/test'
import { assertNoUpgradeBanner } from '../helpers/page-assertions'

// Intentional: FEATURE_TIERS.import was lowered from 2 → 1 in friction-reduction sprint
// (2026-05-27). Tier 1 consumers must reach /import without an upgrade banner.
test.describe('Import data access (tier 1+ fixture)', () => {
  test('/import shows importer for tier 1+ account', async ({ page }) => {
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

import { test, expect } from '@playwright/test'
import { CONSUMER_ESTATE_TIER_ROUTES } from '../helpers/routes'
import { assertNoUpgradeBanner, assertPageLoads } from '../helpers/page-assertions'

test.describe('Estate-tier consumer routes (no upgrade gate)', () => {
  for (const route of CONSUMER_ESTATE_TIER_ROUTES) {
    test(`${route.path} loads without upgrade banner`, async ({ page }) => {
      await assertPageLoads(page, route.path, route.heading)
      await assertNoUpgradeBanner(page)
    })
  }

  test('/trust-will redirects to trust strategy tab', async ({ page }) => {
    await page.goto('/trust-will')
    await expect(page).toHaveURL(/\/my-estate-trust-strategy/, { timeout: 20_000 })
    await expect(page.url()).toContain('tab=trusts')
  })
})

import { test, expect } from '@playwright/test'
import { assertUpgradeBanner } from '../helpers/page-assertions'

test.describe('Tier-1 upgrade gates', () => {
  test('/my-family shows upgrade banner', async ({ page }) => {
    await page.goto('/my-family')
    await assertUpgradeBanner(page, 'My Family')
  })

  test('/social-security shows upgrade banner', async ({ page }) => {
    await page.goto('/social-security')
    await assertUpgradeBanner(page)
  })
})

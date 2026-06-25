import { test, expect } from '@playwright/test'
import { assertUpgradeBanner } from '../helpers/page-assertions'

test.describe('Tier-0 upgrade gates (ex-subscriber)', () => {
  test('/import shows upgrade banner', async ({ page }) => {
    await page.goto('/import')
    await assertUpgradeBanner(page, 'Import Data')
  })

  test('/projections shows upgrade banner', async ({ page }) => {
    await page.goto('/projections')
    await assertUpgradeBanner(page, 'Forward Projections')
  })

  test('/scenarios shows upgrade banner', async ({ page }) => {
    await page.goto('/scenarios')
    await assertUpgradeBanner(page, 'What-If Scenarios')
  })

  test('/insurance allows policy entry without gap analysis', async ({ page }) => {
    await page.goto('/insurance')
    await expect(page.getByRole('heading', { name: /life.*estate insurance|insurance/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: '+ Add Policy' })).toBeVisible()
    await expect(page.getByText(/recommended coverage vs your current policies/i)).toHaveCount(0)
    await assertUpgradeBanner(page, 'Coverage gap analysis')
  })

  test('/real-estate allows property entry without computed readouts', async ({ page }) => {
    await page.goto('/real-estate')
    await expect(page.getByRole('heading', { name: 'Real Estate' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: '+ Add Property' })).toBeVisible()
    await expect(page.getByText('Total equity')).toHaveCount(0)
    await assertUpgradeBanner(page, 'Real estate analysis')
  })
})

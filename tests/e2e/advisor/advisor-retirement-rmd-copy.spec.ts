import { test, expect } from '@playwright/test'
import { clickAdvisorClientTab, gotoMichaelJohnsonClient } from '../helpers/constants'

test.describe('Advisor retirement RMD copy (Michael Johnson fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMichaelJohnsonClient(page)
  })

  test('retirement tab shows RMD timeline (SECURE 2.0 cohort for birth 1965+)', async ({ page }) => {
    await clickAdvisorClientTab(page, /Retirement/)
    await expect(page.getByText('RMD Timeline').first()).toBeVisible({ timeout: 30_000 })
    // Fixture: Michael Johnson born 1965 → RMD start age 75; UI shows years-until-RMD chip.
    await expect(page.getByText(/\d+yr to RMD|RMDs Active|\(age 75\)/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

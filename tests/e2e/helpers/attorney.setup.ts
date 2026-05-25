import { test as setup } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'

setup('authenticate attorney portal', async ({ page }) => {
  const email =
    process.env.PLAYWRIGHT_ATTORNEY_EMAIL ?? E2E_IDENTITIES.attorneyPortal.email
  const password =
    process.env.PLAYWRIGHT_ATTORNEY_PASSWORD ?? E2E_IDENTITIES.attorneyPortal.password

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90_000 })
  await page.context().storageState({ path: '.auth/attorney.json' })
})

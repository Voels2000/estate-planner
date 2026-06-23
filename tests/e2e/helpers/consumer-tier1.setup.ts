import { test as setup } from '@playwright/test'
import { resolveTier1Credentials, syncE2ePasswordForEmail } from './e2e-auth'

setup('authenticate tier-1 consumer', async ({ page }) => {
  const { email, password } = resolveTier1Credentials()

  await syncE2ePasswordForEmail(email, password)

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
  await page.context().storageState({ path: '.auth/consumer-tier1.json' })
})

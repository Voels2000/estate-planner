import { test as setup } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { resolveE2eEmail, resolveE2ePassword, syncE2ePasswordForEmail } from './e2e-auth'

setup('authenticate tier-1 consumer', async ({ page }) => {
  const email = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL,
    E2E_IDENTITIES.consumerTier1.email,
  )
  const password = resolveE2ePassword(email, process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD)

  await syncE2ePasswordForEmail(email, password)

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
  await page.context().storageState({ path: '.auth/consumer-tier1.json' })
})

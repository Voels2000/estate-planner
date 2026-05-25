import { test as setup } from '@playwright/test'

setup('authenticate tier-1 consumer', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL
  const password = process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD
  if (!email || !password) {
    throw new Error('PLAYWRIGHT_CONSUMER_TIER1_EMAIL and PLAYWRIGHT_CONSUMER_TIER1_PASSWORD must be set')
  }

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 })
  await page.context().storageState({ path: '.auth/consumer-tier1.json' })
})

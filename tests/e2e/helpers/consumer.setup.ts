import { test as setup } from '@playwright/test'

setup('authenticate consumer', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_CONSUMER_EMAIL
  const password = process.env.PLAYWRIGHT_CONSUMER_PASSWORD
  if (!email || !password) {
    throw new Error('PLAYWRIGHT_CONSUMER_EMAIL and PLAYWRIGHT_CONSUMER_PASSWORD must be set (e.g. via .env.test)')
  }

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 })

  await page.context().storageState({ path: '.auth/consumer.json' })
})

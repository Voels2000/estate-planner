import { test as setup, expect } from '@playwright/test'

setup('authenticate advisor', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_ADVISOR_EMAIL
  const password = process.env.PLAYWRIGHT_ADVISOR_PASSWORD
  if (!email || !password) {
    throw new Error('PLAYWRIGHT_ADVISOR_EMAIL and PLAYWRIGHT_ADVISOR_PASSWORD must be set (e.g. via .env.test)')
  }

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Advisor lands on /advisor/* or /billing depending on subscription
  await page.waitForURL(/\/(advisor|billing)/, { timeout: 90_000 })

  // Confirm we didn't land somewhere unexpected (e.g. /dashboard = consumer redirect)
  expect(page.url()).toMatch(/\/(advisor|billing)/)

  await page.context().storageState({ path: '.auth/advisor.json' })
})

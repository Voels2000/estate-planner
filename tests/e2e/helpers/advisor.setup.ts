import { test as setup } from '@playwright/test'

setup('authenticate advisor', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_ADVISOR_EMAIL
  const password = process.env.PLAYWRIGHT_ADVISOR_PASSWORD
  if (!email || !password) {
    throw new Error('PLAYWRIGHT_ADVISOR_EMAIL and PLAYWRIGHT_ADVISOR_PASSWORD must be set (e.g. via .env.test)')
  }

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 90_000 })
  await page.context().storageState({ path: '.auth/advisor.json' })
})

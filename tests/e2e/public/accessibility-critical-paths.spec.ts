import { test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../helpers/axe-a11y'

test.describe('Accessibility — public critical paths', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'visible' })
    await expectNoSeriousA11yViolations(page, '/login')
  })

  test('signup page', async ({ page }) => {
    await page.goto('/signup?invite=1')
    await page.getByRole('heading', { name: /create your account/i }).waitFor({ state: 'visible' })
    await expectNoSeriousA11yViolations(page, '/signup')
  })

  test('assess landing', async ({ page }) => {
    await page.goto('/assess')
    await page.getByRole('heading').first().waitFor({ state: 'visible' })
    await expectNoSeriousA11yViolations(page, '/assess')
  })
})

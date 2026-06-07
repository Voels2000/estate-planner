import { test, expect } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../helpers/axe-a11y'

test.describe('Accessibility — consumer critical paths', () => {
  test('dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/Good (morning|afternoon|evening)|Estate/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await expectNoSeriousA11yViolations(page, '/dashboard')
  })

  test('profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible({
      timeout: 30_000,
    })
    await expectNoSeriousA11yViolations(page, '/profile')
  })
})

import { test, expect } from '@playwright/test'

test.describe('Prospect mode', () => {
  test('prospect page loads and shows form', async ({ page }) => {
    await page.goto('/prospect')
    await expect(page.getByRole('heading', { name: 'Prospect Mode' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate Summary' })).toBeVisible()
  })

  test('/advisor/prospect redirects to /prospect', async ({ page }) => {
    await page.goto('/advisor/prospect')
    await expect(page).toHaveURL(/\/prospect/)
    await expect(page.getByRole('heading', { name: 'Prospect Mode' })).toBeVisible()
  })
})

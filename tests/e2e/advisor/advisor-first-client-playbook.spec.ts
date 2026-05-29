import { test, expect } from '@playwright/test'

test.describe('Advisor portal activation', () => {
  test('advisor portal loads client roster or empty state', async ({ page }) => {
    await page.goto('/advisor')
    await expect(
      page.getByRole('heading', { name: 'Advisor Portal' }).or(page.getByText('Connect your first client')),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('advisor client list shows health score column header when clients exist', async ({
    page,
  }) => {
    await page.goto('/advisor')
    const hasClients = await page.getByText('Health Score').isVisible().catch(() => false)
    const emptyState = page.getByText('Connect your first client')
    await expect(hasClients ? page.getByText('Health Score') : emptyState).toBeVisible({
      timeout: 30_000,
    })
  })
})

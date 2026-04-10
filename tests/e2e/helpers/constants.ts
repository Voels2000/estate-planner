import type { Page } from '@playwright/test'

/** Navigate from /advisor to a linked client (prefers Michael & Sarah Johnson when listed). */
export async function gotoMichaelJohnsonClient(page: Page) {
  await page.goto('/advisor')
  await page.getByText('My Clients').first().waitFor({ state: 'visible', timeout: 30_000 })
  const johnsonRow = page.locator('tbody tr').filter({ hasText: /Johnson/ }).first()
  const targetRow = (await johnsonRow.count()) > 0
    ? johnsonRow
    : page.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'View →' }) }).first()
  await targetRow.getByRole('link', { name: 'View →' }).click()
  await page.waitForURL(/\/advisor\/clients\/[a-f0-9-]+$/)
}

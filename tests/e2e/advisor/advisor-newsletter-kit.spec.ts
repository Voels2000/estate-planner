import { test, expect } from '@playwright/test'

test.describe('Advisor newsletter kit', () => {
  test('advisor home shows event links with ref param', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByText('My Clients').first()).toBeVisible({ timeout: 30_000 })

    const kit = page.getByText('Newsletter Kit')
    if (!(await kit.isVisible().catch(() => false))) {
      test.skip(true, 'Newsletter Kit not visible for this advisor account')
      return
    }

    await kit.scrollIntoViewIfNeeded()
    await expect(kit).toBeVisible()

    const eventLink = page.locator('a[href*="/event/"][href*="ref="]').first()
    await expect(eventLink).toBeVisible({ timeout: 15_000 })
    const href = await eventLink.getAttribute('href')
    expect(href).toMatch(/\/event\//)
    expect(href).toMatch(/ref=/)
  })
})

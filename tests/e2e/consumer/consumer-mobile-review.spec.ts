import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('Mobile review mode', () => {
  test('dashboard renders without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/Good (morning|afternoon|evening)|Estate/i).first()).toBeVisible({
      timeout: 30_000,
    })

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 2
    })
    expect(overflow).toBe(false)
  })

  test('projections page uses scroll wrapper for tables', async ({ page }) => {
    await page.goto('/projections')
    await expect(page.getByText(/projection/i).first()).toBeVisible({ timeout: 30_000 })

    const hasScrollWrapper = await page.evaluate(() =>
      Boolean(document.querySelector('.overflow-x-auto')),
    )
    expect(hasScrollWrapper).toBe(true)
  })
})

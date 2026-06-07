import { expect, type Page } from '@playwright/test'

export const MOBILE_VIEWPORT = { width: 390, height: 844 }

export async function waitForDashboard(page: Page) {
  await expect(
    page.getByText(/Good (morning|afternoon|evening)|Estate/i).first(),
  ).toBeVisible({ timeout: 30_000 })
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth > doc.clientWidth + 2
  })
  expect(overflow).toBe(false)
}

export async function assertHasHorizontalScrollWrapper(page: Page) {
  const hasScrollWrapper = await page.evaluate(() =>
    Boolean(document.querySelector('.overflow-x-auto')),
  )
  expect(hasScrollWrapper).toBe(true)
}

export async function assertDrawerClosed(page: Page) {
  await expect(page.locator('#dashboard-sidebar')).toHaveClass(/-translate-x-full/)
}

export async function openMobileNavDrawer(page: Page) {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.locator('#dashboard-sidebar')).toHaveClass(/translate-x-0/)
}

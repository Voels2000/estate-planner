import { test, expect } from '@playwright/test'
import { EVENT_SLUGS, SPOT_CHECK_EVENT_SLUGS } from '../helpers/event-slugs'
import { PUBLIC_MARKETING_ROUTES } from '../helpers/routes'

test.describe('Public marketing routes', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const route of PUBLIC_MARKETING_ROUTES) {
    test(`${route.path} loads`, async ({ page }) => {
      const res = await page.goto(route.path)
      expect(res?.status(), `${route.path} should not 404`).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({
        timeout: 30_000,
      })
    })
  }

  test('/advisor-directory redirects to find-advisor', async ({ page }) => {
    await page.goto('/advisor-directory')
    await expect(page).toHaveURL(/\/find-advisor/, { timeout: 20_000 })
  })
})

test.describe('Life event pages — all slugs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const slug of EVENT_SLUGS) {
    test(`/event/${slug} returns 200`, async ({ page }) => {
      const res = await page.goto(`/event/${slug}`)
      expect(res?.status()).toBeLessThan(400)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 })
    })
  }

  test('/event/rmd-start-age mentions 72–75 cohort copy', async ({ page }) => {
    await page.goto('/event/rmd-start-age')
    await expect(page.getByText(/72|73|75/).first()).toBeVisible()
  })
})

test.describe('Life event spot-check slugs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const slug of SPOT_CHECK_EVENT_SLUGS) {
    test(`/event/${slug}/assess loads`, async ({ page }) => {
      const res = await page.goto(`/event/${slug}/assess`)
      expect(res?.status()).toBeLessThan(400)
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30_000 })
    })
  }
})

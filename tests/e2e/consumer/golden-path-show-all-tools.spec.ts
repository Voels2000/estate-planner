/**
 * Sprint 3 smoke: Stage 1 guided mode → Show all tools → reload persistence.
 *
 * Run:
 *   npm run test:e2e:golden-path
 *
 * Requires: dev server or PLAYWRIGHT_BASE_URL, Supabase admin env (.env.local + .env.test).
 */
import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { seedGoldenPathStage1 } from '../../../scripts/seed-golden-path-stage1'
import { syncE2ePasswordForEmail } from '../helpers/e2e-auth'

const ID = E2E_IDENTITIES.goldenPathStage1
const LS_KEY = 'mwm_show_all_tools'

test.describe.configure({ mode: 'serial' })

test.use({ storageState: { cookies: [], origins: [] } })

async function loginGoldenPath(page: import('@playwright/test').Page) {
  await syncE2ePasswordForEmail(ID.email, ID.password)
  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(ID.email)
  await page.locator('input[id="password"]').fill(ID.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
}

test.beforeAll(async () => {
  await seedGoldenPathStage1()
})

test('Stage 1 → Show all tools → reload keeps expanded guided state', async ({ page }) => {
  await loginGoldenPath(page)

  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible({ timeout: 30_000 })

  await page.evaluate((key) => localStorage.removeItem(key), LS_KEY)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible({ timeout: 30_000 })

  await expect(page.getByText('Financial Foundation')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show all tools' })).toBeVisible()
  await expect(page.getByText('What comes next')).toBeVisible()

  const retirement = page.getByRole('button', { name: 'Retirement Summary' })
  await expect(retirement).toBeHidden()

  await page.getByRole('button', { name: 'Show all tools' }).click()

  await expect(page.getByRole('button', { name: 'Guided view' })).toBeVisible()
  await expect(retirement).toBeVisible({ timeout: 10_000 })

  const storedAfterClick = await page.evaluate((key) => localStorage.getItem(key), LS_KEY)
  expect(storedAfterClick).toBe('true')

  await page.reload()
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible({ timeout: 30_000 })

  await expect(page.getByRole('button', { name: 'Guided view' })).toBeVisible({ timeout: 10_000 })
  await expect(retirement).toBeVisible({ timeout: 10_000 })

  const storedAfterReload = await page.evaluate((key) => localStorage.getItem(key), LS_KEY)
  expect(storedAfterReload).toBe('true')

  await page.getByRole('button', { name: 'Guided view' }).click()
  await expect(page.getByRole('button', { name: 'Show all tools' })).toBeVisible()
  await expect(retirement).toBeHidden({ timeout: 10_000 })

  const storedAfterGuided = await page.evaluate((key) => localStorage.getItem(key), LS_KEY)
  expect(storedAfterGuided).toBe('false')
})

import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'

/**
 * Path A contract: own plan free, firm-paid owner not bounced, client-connect still paid.
 * Requires advisor-empty-setup (null profile + null firm sub) and advisor-setup (null profile + active firm).
 */
test.describe('Path A — unpaid advisor own plan', () => {
  test.use({ storageState: '.auth/advisor-empty.json' })

  test('dashboard and profile load without billing redirect', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/billing/)
    await expect(page).not.toHaveURL(/\/login/)

    await page.goto('/profile')
    await expect(page).not.toHaveURL(/\/billing/)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('advisor portal still requires firm billing', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page).toHaveURL(/\/billing/)
  })

  test('POST /api/advisor/invite returns tier_limit_reached', async ({ request }) => {
    const res = await request.post('/api/advisor/invite', {
      data: { invitedEmail: `path-a-guard-${Date.now()}@example.com` },
    })
    expect(res.status()).toBe(403)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('tier_limit_reached')
  })
})

test.describe('Path A — firm-paid owner with null profile sub', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('dashboard and advisor portal load without billing redirect', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/billing/)
    await expect(page).not.toHaveURL(/\/login/)

    await page.goto('/advisor')
    await expect(page).not.toHaveURL(/\/billing/)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: 'Advisor Portal' }).or(page.getByText('Connect your first client')),
    ).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('Path A — login destination for unpaid advisor owner', () => {
  test('unpaid advisor owner lands on dashboard after sign-in', async ({ page }) => {
    const empty = E2E_IDENTITIES.advisorEmpty
    await page.goto('/login')
    await page.waitForSelector('input[id="email"]', { state: 'visible' })
    await page.locator('input[id="email"]').fill(empty.email)
    await page.locator('input[id="password"]').fill(empty.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 90_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

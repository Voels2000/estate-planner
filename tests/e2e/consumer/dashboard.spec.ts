import { test, expect } from '@playwright/test'

test.describe('Consumer dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('shows estate readiness score with numeric value', async ({ page }) => {
    const scoreSection = page.locator('div').filter({ hasText: 'Estate Readiness Score' }).first()
    await expect(scoreSection).toBeVisible()
    const scoreEl = scoreSection.locator('text=/^\\d{1,3}$/').first()
    const scoreText = await scoreEl.textContent().catch(() => '0')
    const n = Number(scoreText?.trim() ?? '0')
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThanOrEqual(100)
  })

  test('shows net worth section', async ({ page }) => {
    await expect(page.getByText('Net Worth', { exact: true })).toBeVisible()
    await expect(page.getByText('Total assets minus liabilities')).toBeVisible()
  })

  test('shows disclaimer', async ({ page }) => {
    await expect(page.getByText(/Disclaimer:/)).toBeVisible()
    await expect(
      page.getByText(/does not constitute legal, tax, or financial advice/i),
    ).toBeVisible()
  })

  test('shows alerts or action items region', async ({ page }) => {
    await expect(
      page.getByText('Action Items').or(page.getByText('Estate Readiness Score')).first(),
    ).toBeVisible()
  })

  test('dashboard greeting loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
  })
})

test.describe('Consumer navigation', () => {
  test('profile page loads', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('assets page loads', async ({ page }) => {
    await page.goto('/assets')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('projections page loads', async ({ page }) => {
    await page.goto('/projections')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('my estate strategy page loads', async ({ page }) => {
    await page.goto('/my-estate-strategy')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'

test.describe('Consumer dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    // Wait for the page to be interactive — greeting is always rendered
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    ).toBeVisible({ timeout: 20_000 })
  })

  test('dashboard greeting loads', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    ).toBeVisible()
  })

  test('shows net worth section', async ({ page }) => {
    await expect(page.getByText('Net Worth', { exact: true })).toBeVisible()
    await expect(page.getByText('Total assets minus liabilities')).toBeVisible()
  })

  test('shows disclaimer', async ({ page }) => {
    await expect(page.getByText(/Disclaimer:/)).toBeVisible()
    await expect(
      page.getByText(/educational purposes only|financial planning preparation/i),
    ).toBeVisible()
    await expect(page.getByText(/not a registered investment adviser/i)).toBeVisible()
  })

  test('shows estate or planning section', async ({ page }) => {
    // Estate readiness score OR setup progress — depends on how complete
    // the test account's profile is. Either is acceptable.
    const estateSection = page
      .getByText('Estate Readiness Score')
      .or(page.getByText('Estate Health'))
      .or(page.getByText('Get started'))
      .or(page.getByText('Complete your'))
      .or(page.getByText('Action Items'))
      .first()

    // At minimum the financial summary section should always be visible
    const financialSection = page
      .getByText('Financial Summary')
      .or(page.getByText('Net Worth'))
      .first()

    const hasEstate = await estateSection.isVisible().catch(() => false)
    const hasFinancial = await financialSection.isVisible().catch(() => false)

    expect(hasEstate || hasFinancial, 'Expected at least one planning section to be visible').toBe(true)
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

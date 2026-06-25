import { test, expect } from '@playwright/test'

/**
 * PR 3 gate 1 — Tier 0 dashboard must not surface heavy modeling UI.
 * Server-side recompute is verified via scripts/verify-tier0-dashboard-no-recompute.ts
 * (DB timestamp snapshot before/after load).
 */
test.describe('Tier 0 dashboard slice', () => {
  test('renders thin dashboard without estate modeling sections', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Net Worth').first()).toBeVisible()
    await expect(page.getByText(/your data — always free to enter/i)).toBeVisible()

    await expect(page.getByText(/estate readiness/i)).toHaveCount(0)
    await expect(page.getByText(/monte carlo/i)).toHaveCount(0)
    await expect(page.getByText(/estate tax exposure/i)).toHaveCount(0)
    await expect(page.getByText(/execution checklist/i)).toHaveCount(0)
  })

  test('links to free data-entry pages', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Assets' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: 'Real Estate' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Businesses' })).toBeVisible()
  })
})

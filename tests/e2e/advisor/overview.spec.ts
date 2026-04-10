import { test, expect } from '@playwright/test'
import { gotoMichaelJohnsonClient } from '../helpers/constants'

test.describe('Advisor client list', () => {
  test('advisor dashboard loads', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByText('My Clients').first()).toBeVisible()
  })

  test('at least one linked client appears in the table', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByRole('link', { name: 'View →' }).first()).toBeVisible()
  })
})

test.describe('Advisor client overview', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMichaelJohnsonClient(page)
  })

  test('client header shows name and complexity', async ({ page }) => {
    await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText(/Complexity/).first()).toBeVisible()
  })

  test('overview tab shows net worth', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Overview/ })).toBeVisible()
    await expect(page.getByText('Net Worth').first()).toBeVisible()
  })

  test('all main tabs are present', async ({ page }) => {
    for (const label of ['Strategy', 'Tax', 'Domicile', 'Estate', 'Retirement', 'Documents', 'Notes', 'Meeting Prep']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }
  })

  test('strategy tab shows advisory metrics or loading', async ({ page }) => {
    await page.getByRole('button', { name: /Strategy/ }).click()
    await expect(
      page.getByText('Advisory Metrics Dashboard').or(page.locator('.animate-pulse')).first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('tax tab shows law scenario', async ({ page }) => {
    await page.getByRole('button', { name: /Tax/ }).click()
    await expect(page.getByText('Law Scenario')).toBeVisible()
  })

  test('estate tab shows estate flow', async ({ page }) => {
    await page.getByRole('button', { name: /Estate/ }).click()
    await expect(page.getByRole('heading', { name: 'Estate Flow' })).toBeVisible()
  })

  test('documents tab loads', async ({ page }) => {
    await page.getByRole('button', { name: /Documents/ }).click()
    await expect(
      page.getByText(/Legal Document Vault|No documents in vault/).first(),
    ).toBeVisible()
  })
})

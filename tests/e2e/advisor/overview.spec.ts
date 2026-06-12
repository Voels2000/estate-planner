import { test, expect } from '@playwright/test'
import { clickAdvisorClientTab, gotoAdvisorLinkedClient } from '../helpers/constants'

test.describe('Advisor client list', () => {
  test('advisor portal loads client roster or empty state', async ({ page }) => {
    await page.goto('/advisor')
    await expect(
      page.getByRole('heading', { name: 'Advisor Portal' }).or(page.getByText('Connect your first client')),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('advisor dashboard loads', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByText('My Clients').first()).toBeVisible()
  })

  test('health score column or getting-started playbook when clients exist', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByRole('button', { name: /My Clients/ })).toBeVisible({ timeout: 30_000 })
    const rosterMarker = page
      .getByRole('columnheader', { name: 'Health Score' })
      .or(page.getByText(/Getting started with/i))
      .or(page.getByText('Connect your first client'))
    await expect(rosterMarker.first()).toBeVisible({ timeout: 30_000 })
  })

  test('at least one linked client appears in the table', async ({ page }) => {
    await page.goto('/advisor')
    await expect(page.getByRole('link', { name: 'View →' }).first()).toBeVisible()
  })
})

test.describe('Advisor client overview', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAdvisorLinkedClient(page)
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

  test('strategy tab shows situation metrics or loading', async ({ page }) => {
    await clickAdvisorClientTab(page, /Strategy/)
    await expect(
      page.getByText('Situation').first().or(page.locator('.animate-pulse').first()),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('tax tab shows law scenario', async ({ page }) => {
    await clickAdvisorClientTab(page, /Tax/)
    await expect(page.getByRole('heading', { name: 'Law Scenario' })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('estate tab shows estate flow', async ({ page }) => {
    await clickAdvisorClientTab(page, /Estate/)
    await expect(page.getByRole('heading', { name: 'Estate Flow' })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('documents tab loads', async ({ page }) => {
    await page.getByRole('button', { name: /Documents/ }).click()
    await expect(
      page.getByText(/Legal Document Vault|No documents in vault/).first(),
    ).toBeVisible()
  })
})

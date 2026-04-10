import { test, expect } from '@playwright/test'
import { gotoMichaelJohnsonClient } from '../helpers/constants'

test.beforeEach(async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
})

test('strategy tab shows eight metric cards when estate data is loaded', async ({ page }) => {
  await page.getByRole('button', { name: /Strategy/ }).click()
  const dashboard = page.getByText('Advisory Metrics Dashboard')
  const loading = page.locator('.animate-pulse')
  await expect(dashboard.or(loading).first()).toBeVisible({ timeout: 30_000 })
  if (await dashboard.isVisible()) {
    const metricGrid = page.locator('[data-household-id] .grid.gap-3').first()
    await expect(metricGrid.locator(':scope > div')).toHaveCount(8)
  }
})

test('tax tab: current law shows federal estate tax row', async ({ page }) => {
  await page.getByRole('button', { name: /Tax/ }).click()
  await expect(page.getByText('Federal Estate Tax').first()).toBeVisible()
})

test('tax tab: no exemption scenario shows $0 federal exemption label path', async ({ page }) => {
  await page.getByRole('button', { name: /Tax/ }).click()
  await page.getByRole('button', { name: /No Exemption/i }).click()
  await expect(page.getByText(/No Exemption/i).first()).toBeVisible()
})

test('estate tab: spouse death order toggles', async ({ page }) => {
  await page.getByRole('button', { name: /Estate/ }).click()
  await expect(page.getByRole('heading', { name: 'Estate Flow' })).toBeVisible()
  await page.getByRole('button', { name: /Spouse 2 First/i }).click()
  await expect(page.getByRole('button', { name: /Spouse 2 First/i })).toBeVisible()
})

test('retirement tab loads', async ({ page }) => {
  await page.getByRole('button', { name: /Retirement/ }).click()
  await expect(page.getByText(/RMD|Retirement|Monte Carlo/i).first()).toBeVisible()
})

test('meeting prep tab shows export actions', async ({ page }) => {
  await page.getByRole('button', { name: /Meeting Prep/ }).click()
  await expect(page.getByRole('button', { name: /Export PDF Report/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible()
})

test('strategy tab includes metric explanations accordion', async ({ page }) => {
  await page.getByRole('button', { name: /Strategy/ }).click()
  const dashboard = page.getByText('Advisory Metrics Dashboard')
  await expect(dashboard.or(page.locator('.animate-pulse')).first()).toBeVisible({ timeout: 30_000 })
  if (await dashboard.isVisible()) {
    await expect(page.getByText('Metric Explanations')).toBeVisible()
  }
})

test('overview balance sheet shows assets and liabilities', async ({ page }) => {
  await expect(page.getByText('Balance Sheet')).toBeVisible()
  await expect(page.getByText('Assets').first()).toBeVisible()
})

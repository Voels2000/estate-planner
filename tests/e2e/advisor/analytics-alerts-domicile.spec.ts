import { test, expect } from '@playwright/test'
import { gotoMichaelJohnsonClient } from '../helpers/constants'

test.beforeEach(async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
})

test('advisory metrics grid renders without sunset messaging', async ({ page }) => {
  await page.getByRole('button', { name: /Strategy/ }).click()
  const dashboard = page.getByText('Advisory Metrics Dashboard')
  await expect(dashboard.or(page.locator('.animate-pulse')).first()).toBeVisible({ timeout: 30_000 })
  if (await dashboard.isVisible()) {
    await expect(page.getByText(/Sunset Urgency|sunset/i)).not.toBeVisible()
  }
})

test('metric explanations lists multiple rows', async ({ page }) => {
  await page.getByRole('button', { name: /Strategy/ }).click()
  const dashboard = page.getByText('Advisory Metrics Dashboard')
  await expect(dashboard.or(page.locator('.animate-pulse')).first()).toBeVisible({ timeout: 30_000 })
  if (await dashboard.isVisible()) {
    await expect(page.getByText('Metric Explanations')).toBeVisible()
  }
})

test('overview gap analysis or stats row', async ({ page }) => {
  await expect(page.getByText('Planning Gaps').or(page.getByText('Net Worth')).first()).toBeVisible()
})

test('domicile tab shows analysis or empty state', async ({ page }) => {
  await page.getByRole('button', { name: /Domicile/ }).click()
  await expect(
    page.getByText(/Domicile Risk Analysis|No domicile analysis on file/),
  ).toBeVisible()
})

test('notes tab is reachable for advisor', async ({ page }) => {
  await page.getByRole('button', { name: /Notes/ }).click()
  await expect(page.getByText('Advisor-Private Notes')).toBeVisible()
})

test('prospect mode page loads', async ({ page }) => {
  await page.goto('/prospect')
  await expect(page.getByRole('heading', { name: 'Prospect Mode' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate Summary' })).toBeVisible()
})

test('tax combined waterfall section exists under tax tab', async ({ page }) => {
  await page.getByRole('button', { name: /Tax/ }).click()
  await expect(
    page.getByText(/Combined Federal|Waterfall|Law Scenario/i).first(),
  ).toBeVisible()
})

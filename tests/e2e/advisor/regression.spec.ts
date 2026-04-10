import { test, expect } from '@playwright/test'
import { gotoMichaelJohnsonClient } from '../helpers/constants'

test('back to client list returns to advisor home', async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
  await page.getByText('Back to Client List').click()
  await expect(page).toHaveURL(/\/advisor\/?$/)
})

test('advisor can open client list', async ({ page }) => {
  await page.goto('/advisor')
  await expect(page.getByText('My Clients').first()).toBeVisible()
})

test('advisor can open a linked client workspace', async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
  await expect(page.getByText('Back to Client List')).toBeVisible()
})

test('client overview shows net worth stat', async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
  await expect(page.getByText('Net Worth').first()).toBeVisible()
})

test('strategy and tax tabs switch without error', async ({ page }) => {
  await gotoMichaelJohnsonClient(page)
  await page.getByRole('button', { name: /Strategy/ }).click()
  const dashboard = page.getByText('Advisory Metrics Dashboard')
  const strategyLoading = page.locator('.animate-pulse')
  await expect(dashboard.or(strategyLoading).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /Tax/ }).click()
  await expect(page.getByText('Law Scenario')).toBeVisible()
})

test('public terms API responds', async ({ request }) => {
  const res = await request.get('/api/terms/content')
  expect(res.ok()).toBeTruthy()
})

test('public OpenAPI spec is served', async ({ request }) => {
  const res = await request.get('/api/projection/run')
  const json = await res.json()
  expect(json.openapi).toBeDefined()
})

test.describe('without advisor session', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page does not 404', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()
  })
})

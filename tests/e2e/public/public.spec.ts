import { test, expect } from '@playwright/test'

test('terms API returns version and sections', async ({ request }) => {
  const res = await request.get('/api/terms/content')
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json).toHaveProperty('version')
  expect(json).toHaveProperty('sections')
})

test('projection run GET returns OpenAPI spec', async ({ request }) => {
  const res = await request.get('/api/projection/run')
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json.openapi).toBe('3.0.0')
  expect(json.info?.title).toBeTruthy()
})

test('invalid beneficiary token shows unavailable message', async ({ page }) => {
  await page.goto('/beneficiary/e2e-invalid-token-00000000')
  await expect(page.getByRole('heading', { name: 'Link Unavailable' })).toBeVisible()
  await expect(page.getByText(/invalid|expired|revoked/i)).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('signup page is reachable', async ({ page }) => {
  await page.goto('/signup')
  await expect(page).not.toHaveURL(/404/)
})

test('forgot-password page is reachable', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page).not.toHaveURL(/404/)
})

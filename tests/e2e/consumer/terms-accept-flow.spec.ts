import { test, expect } from '@playwright/test'

test.describe('Terms accept flow (post-checkout)', () => {
  test('/terms/accept loads for authenticated user', async ({ page }) => {
    await page.goto('/terms/accept?returnTo=/dashboard')
    await expect(page).not.toHaveURL(/\/login/)

    const termsUi = page
      .getByRole('button', { name: /accept|agree|continue/i })
      .or(page.getByText(/terms of service/i))
      .first()
    const dashboardGreeting = page.getByRole('heading', {
      name: /Good (morning|afternoon|evening)/,
    })

    await expect(termsUi.or(dashboardGreeting).first()).toBeVisible({ timeout: 20_000 })
  })

  test('POST /api/terms/accept records acceptance', async ({ request }) => {
    const res = await request.post('/api/terms/accept')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

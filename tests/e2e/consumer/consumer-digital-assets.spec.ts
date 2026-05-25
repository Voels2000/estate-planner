import { test, expect } from '@playwright/test'

test.describe('Digital assets', () => {
  test('/digital-assets loads', async ({ page }) => {
    await page.goto('/digital-assets')
    await expect(page.getByRole('heading', { name: /digital/i }).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('POST /api/consumer/digital-assets creates row', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')

    const res = await request.post('/api/consumer/digital-assets', {
      data: {
        household_id: householdId,
        asset_type: 'cryptocurrency',
        platform: `Playwright Platform ${Date.now()}`,
        description: 'E2E smoke',
        estimated_value: 1000,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()

    if (body.id) {
      await request.delete('/api/consumer/digital-assets', {
        data: { id: body.id, household_id: householdId },
      })
    }
  })
})

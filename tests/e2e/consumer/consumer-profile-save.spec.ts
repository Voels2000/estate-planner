import { test, expect } from '@playwright/test'
import { buildProfilePayloadFromHousehold } from '../helpers/supabase-fixture'

test.describe('Consumer profile save (smoke §3)', () => {
  test('PATCH /api/consumer/profile updates household name', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')

    const payload = await buildProfilePayloadFromHousehold(householdId!)
    test.skip(!payload, 'SUPABASE_SERVICE_ROLE_KEY required to build profile payload')

    const originalName = payload!.householdName
    const stamp = Date.now()
    payload!.householdName = `${originalName} E2E ${stamp}`

    const res = await request.patch('/api/consumer/profile', { data: payload })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.householdId).toBeTruthy()

    payload!.householdName = originalName
    const revert = await request.patch('/api/consumer/profile', { data: payload })
    expect(revert.ok(), await revert.text()).toBeTruthy()
  })

  test('profile page saves household name via UI', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 })

    const target = page.getByPlaceholder('The Smith Household')
    await expect(target).toBeVisible()
    const prior = await target.inputValue()
    const next = `${prior} E2E`.trim().slice(0, 120)
    await target.fill(next)
    await page.getByRole('button', { name: /Save Profile/i }).click()
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(target).toHaveValue(next)
    await target.fill(prior)
    await page.getByRole('button', { name: /Save Profile/i }).click()
  })
})

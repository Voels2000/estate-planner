import { test, expect } from '@playwright/test'
import { buildProfilePayloadFromHousehold, fetchHouseholdById } from '../helpers/supabase-fixture'

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

  test('partial PATCH with SS fields only preserves other household fields', async ({
    request,
  }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')

    const payload = await buildProfilePayloadFromHousehold(householdId!)
    test.skip(!payload, 'SUPABASE_SERVICE_ROLE_KEY required to build profile payload')

    const before = await fetchHouseholdById(householdId!)
    test.skip(!before, 'Could not load household row')

    const originalClaiming = before!.person1_ss_claiming_age
    const originalPia = before!.person1_ss_pia
    const originalRetirement = before!.person1_retirement_age
    const stampClaiming = originalClaiming === 68 ? 67 : 68
    const stampPia = originalPia === 2550 ? 2540 : 2550

    const res = await request.patch('/api/consumer/profile', {
      data: {
        householdId,
        person1SSClaimingAge: String(stampClaiming),
        person1SSPia: String(stampPia),
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    const after = await fetchHouseholdById(householdId!)
    expect(after?.person1_ss_claiming_age).toBe(stampClaiming)
    expect(after?.person1_ss_pia).toBe(stampPia)
    expect(after?.person1_retirement_age).toBe(originalRetirement)

    payload!.person1SSClaimingAge = String(originalClaiming ?? 67)
    payload!.person1SSPia = originalPia != null ? String(originalPia) : ''
    const revert = await request.patch('/api/consumer/profile', { data: payload })
    expect(revert.ok(), await revert.text()).toBeTruthy()
  })

  test('partial PATCH with retirement/longevity only preserves other fields', async ({
    request,
  }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')

    const payload = await buildProfilePayloadFromHousehold(householdId!)
    test.skip(!payload, 'SUPABASE_SERVICE_ROLE_KEY required to build profile payload')

    const before = await fetchHouseholdById(householdId!)
    test.skip(!before, 'Could not load household row')

    const originalSsClaiming = before!.person1_ss_claiming_age
    const stampRetirement = before!.person1_retirement_age === 66 ? 65 : 66
    const stampLongevity = before!.person1_longevity_age === 91 ? 90 : 91

    const res = await request.patch('/api/consumer/profile', {
      data: {
        householdId,
        person1RetirementAge: String(stampRetirement),
        person1LongevityAge: String(stampLongevity),
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    const after = await fetchHouseholdById(householdId!)
    expect(after?.person1_retirement_age).toBe(stampRetirement)
    expect(after?.person1_longevity_age).toBe(stampLongevity)
    expect(after?.person1_ss_claiming_age).toBe(originalSsClaiming)

    payload!.person1RetirementAge = String(before!.person1_retirement_age ?? 65)
    payload!.person1LongevityAge = String(before!.person1_longevity_age ?? 90)
    const revert = await request.patch('/api/consumer/profile', { data: payload })
    expect(revert.ok(), await revert.text()).toBeTruthy()
  })
})

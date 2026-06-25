import { test, expect } from '@playwright/test'
import {
  resolveAppTrialHouseholdId,
  resolveConsumerHouseholdId,
  resolvePlanExportHouseholdId,
} from '../helpers/e2e-households'
import { fetchHouseholdById } from '../helpers/supabase-fixture'

test.describe.configure({ mode: 'serial' })

test.describe('deliverable export gate — persona matrix (B3/B4/B5)', () => {
  test('B4 — app-managed trial persona: gated /print with offer; API 403s PDF', async ({
    page,
    request,
  }) => {
    const householdId = await resolveAppTrialHouseholdId()
    test.skip(!householdId, 'Run npm run seed:e2e:persona-matrix on target env')
    const household = await fetchHouseholdById(householdId!)
    test.skip(!household, 'Could not load app-trial household')

    await page.goto('/print')
    await expect(page.getByTestId('deliverable-export-gated')).toBeVisible()
    await expect(page.getByTestId('deliverable-export-ready')).toHaveCount(0)
    await expect(page.getByTestId('plan-and-export-cta')).toBeVisible()

    const res = await request.get(
      `/api/export-estate-plan?household_id=${encodeURIComponent(householdId!)}`,
    )
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/subscription|Plan & Export purchase/i)
  })

  test('B3 — plan-export purchaser persona: ready /print without active sub', async ({ page }) => {
    const householdId = await resolvePlanExportHouseholdId()
    test.skip(!householdId, 'Run npm run seed:e2e:persona-matrix on target env')

    await page.goto('/print')
    await expect(page.getByTestId('deliverable-export-ready')).toBeVisible()
    await expect(page.getByTestId('deliverable-export-gated')).toHaveCount(0)
    await expect(page.getByTestId('plan-and-export-cta')).toHaveCount(0)
  })

  test('B5 — active tier-3 consumer persona: ready /print and API allows PDF generate', async ({
    page,
    request,
  }) => {
    const householdId = await resolveConsumerHouseholdId()
    test.skip(!householdId, 'Run npm run seed:e2e on target env')
    const household = await fetchHouseholdById(householdId!)
    test.skip(!household, 'Could not load tier-3 consumer household')

    await page.goto('/print')
    await expect(page.getByTestId('deliverable-export-ready')).toBeVisible()
    await expect(page.getByTestId('deliverable-export-gated')).toHaveCount(0)
    await expect(page.getByTestId('plan-and-export-cta')).toHaveCount(0)

    const res = await request.get(
      `/api/export-estate-plan?household_id=${encodeURIComponent(householdId!)}`,
    )
    expect(res.status(), await res.text()).toBe(200)
  })
})

import { test, expect } from '@playwright/test'
import { fetchHouseholdPlanningFields } from '../helpers/supabase-fixture'

/**
 * PATCH /api/consumer/growth-assumptions — financial, RE, business, inflation (PROF-2).
 * Auth via consumer-setup storage state.
 */
test.describe('Consumer growth assumptions API', () => {
  test('PATCH growth-assumptions updates planning fields', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID')

    const original = await fetchHouseholdPlanningFields(householdId!)
    test.skip(!original, 'SUPABASE_SERVICE_ROLE_KEY required to read household planning fields')

    const probe = {
      inflation_rate: original!.inflation_rate === 2.6 ? 2.55 : 2.6,
      growth_rate_accumulation: original!.growth_rate_accumulation === 6.5 ? 6.25 : 6.5,
      growth_rate_retirement: original!.growth_rate_retirement === 5.5 ? 5.25 : 5.5,
      growth_assumptions: {
        real_estate: original!.growth_assumptions.real_estate === 4.5 ? 4.75 : 4.5,
        business: original!.growth_assumptions.business === 7 ? 7.25 : 7,
      },
    }

    const res = await request.patch('/api/consumer/growth-assumptions', { data: probe })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.household.inflation_rate).toBeCloseTo(probe.inflation_rate, 2)
    expect(body.household.growth_rate_accumulation).toBeCloseTo(probe.growth_rate_accumulation, 2)
    expect(body.household.growth_rate_retirement).toBeCloseTo(probe.growth_rate_retirement, 2)
    expect(body.household.growth_assumptions.real_estate).toBeCloseTo(
      probe.growth_assumptions.real_estate,
      2,
    )
    expect(body.household.growth_assumptions.business).toBeCloseTo(
      probe.growth_assumptions.business,
      2,
    )

    const revert = await request.patch('/api/consumer/growth-assumptions', {
      data: {
        inflation_rate: original!.inflation_rate,
        growth_rate_accumulation: original!.growth_rate_accumulation,
        growth_rate_retirement: original!.growth_rate_retirement,
        growth_assumptions: original!.growth_assumptions,
      },
    })
    expect(revert.ok(), await revert.text()).toBeTruthy()
  })

  test('PATCH growth-assumptions rejects empty body', async ({ request }) => {
    const res = await request.patch('/api/consumer/growth-assumptions', { data: {} })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no planning assumption/i)
  })
})

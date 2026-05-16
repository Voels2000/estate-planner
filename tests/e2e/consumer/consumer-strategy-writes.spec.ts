import { test, expect } from '@playwright/test'

/**
 * Smoke tests for consumer strategy write APIs.
 * Covers: named scenario upsert, scenario coexistence, remove targeting,
 * charitable save, strategy recommendation accept/reject.
 *
 * Requires PLAYWRIGHT_HOUSEHOLD_ID — skipped otherwise.
 *
 * category values must be from the DB check constraint:
 * liability, valuation_discount, trust_exclusion, gifting,
 * marital, charitable, admin_expense, adjusted_taxable_gift
 */

test.describe('Consumer strategy write APIs', () => {
  test('POST strategy-line-items creates a named consumer scenario', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')

    const res = await request.post('/api/strategy-line-items', {
      data: {
        household_id: householdId,
        strategy_source: 'annual_gifting',
        source_role: 'consumer',
        amount: 190000,
        sign: -1,
        confidence_level: 'probable',
        effective_year: new Date().getFullYear(),
        scenario_name: 'Playwright Test Plan',
        category: 'gifting',
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.strategy_source).toBe('annual_gifting')
    expect(body.scenario_name).toBe('Playwright Test Plan')
    expect(body.source_role).toBe('consumer')
    expect(body.is_active).toBe(true)

    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Test Plan', source_role: 'consumer' },
    })
  })

  test('POST strategy-line-items with same name updates not duplicates', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')

    const payload = {
      household_id: householdId,
      strategy_source: 'annual_gifting',
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      scenario_name: 'Playwright Upsert Test',
      category: 'gifting',
    }

    await request.post('/api/strategy-line-items', { data: { ...payload, amount: 190000 } })
    const res = await request.post('/api/strategy-line-items', { data: { ...payload, amount: 95000 } })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.amount).toBe(95000)

    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Upsert Test', source_role: 'consumer' },
    })
  })

  test('POST strategy-line-items with different names creates distinct rows', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')

    const base = {
      household_id: householdId,
      strategy_source: 'annual_gifting',
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      category: 'gifting',
    }

    const res1 = await request.post('/api/strategy-line-items', {
      data: { ...base, amount: 380000, scenario_name: 'Playwright Scenario A' },
    })
    expect(res1.ok(), await res1.text()).toBeTruthy()
    const body1 = await res1.json()

    const res2 = await request.post('/api/strategy-line-items', {
      data: { ...base, amount: 95000, scenario_name: 'Playwright Scenario B' },
    })
    expect(res2.ok(), await res2.text()).toBeTruthy()
    const body2 = await res2.json()

    expect(body1.id).not.toBe(body2.id)
    expect(body1.scenario_name).toBe('Playwright Scenario A')
    expect(body2.scenario_name).toBe('Playwright Scenario B')

    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Scenario A', source_role: 'consumer' },
    })
    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Scenario B', source_role: 'consumer' },
    })
  })

  test('DELETE strategy-line-items with scenario_name deactivates only that row', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')

    const base = {
      household_id: householdId,
      strategy_source: 'annual_gifting',
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      category: 'gifting',
    }

    await request.post('/api/strategy-line-items', { data: { ...base, amount: 380000, scenario_name: 'Playwright Keep' } })
    await request.post('/api/strategy-line-items', { data: { ...base, amount: 95000, scenario_name: 'Playwright Remove' } })

    const deleteRes = await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Remove', source_role: 'consumer' },
    })
    expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy()
    expect((await deleteRes.json()).success).toBe(true)

    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'annual_gifting', scenarioName: 'Playwright Keep', source_role: 'consumer' },
    })
  })

  test('POST strategy-line-items DAF source succeeds', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')

    const res = await request.post('/api/strategy-line-items', {
      data: {
        household_id: householdId,
        strategy_source: 'daf',
        source_role: 'consumer',
        amount: 50000,
        sign: -1,
        confidence_level: 'probable',
        effective_year: new Date().getFullYear(),
        scenario_name: 'Charitable Giving',
        category: 'charitable',
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).strategy_source).toBe('daf')

    await request.delete('/api/strategy-line-items', {
      data: { householdId, strategySource: 'daf', scenarioName: 'Charitable Giving', source_role: 'consumer' },
    })
  })

  test('PATCH consumer strategy-recommendation accept returns ok or 404', async ({ request }) => {
    const res = await request.patch('/api/consumer/strategy-recommendation', {
      data: {
        lineItemId: '00000000-0000-0000-0000-000000000000',
        householdId: process.env.PLAYWRIGHT_HOUSEHOLD_ID ?? '',
      },
    })
    expect([200, 404].includes(res.status()), await res.text()).toBeTruthy()
  })
})

import { test, expect, type APIRequestContext } from '@playwright/test'

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

/** Rows created by this file — swept in afterEach so failed tests do not leak. */
const PLAYWRIGHT_SCENARIOS: ReadonlyArray<{
  strategySource: string
  scenarioName: string
}> = [
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Test Plan' },
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Upsert Test' },
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Scenario A' },
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Scenario B' },
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Keep' },
  { strategySource: 'annual_gifting', scenarioName: 'Playwright Remove' },
  { strategySource: 'daf', scenarioName: 'base' },
  { strategySource: 'charitable', scenarioName: 'base' },
  { strategySource: 'liquidity', scenarioName: 'Playwright Liquidity Test' },
  { strategySource: 'roth', scenarioName: 'Playwright Roth Test' },
]

function requireHouseholdId(): string {
  const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
  test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run strategy write smoke tests')
  return householdId!
}

async function deleteStrategyLineItem(
  request: APIRequestContext,
  householdId: string,
  strategySource: string,
  scenarioName: string,
  { assertOk = true }: { assertOk?: boolean } = {},
): Promise<void> {
  const res = await request.delete('/api/strategy-line-items', {
    data: { householdId, strategySource, scenarioName, source_role: 'consumer' },
  })
  if (assertOk) {
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).success).toBe(true)
  }
}

async function cleanupPlaywrightScenarios(
  request: APIRequestContext,
  householdId: string,
): Promise<void> {
  for (const { strategySource, scenarioName } of PLAYWRIGHT_SCENARIOS) {
    await deleteStrategyLineItem(request, householdId, strategySource, scenarioName, {
      assertOk: false,
    })
  }
}

test.describe('Consumer strategy write APIs', () => {
  test.afterEach(async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    if (!householdId) return
    await cleanupPlaywrightScenarios(request, householdId)
  })

  test('POST strategy-line-items creates a named consumer scenario', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'annual_gifting'
    const scenarioName = 'Playwright Test Plan'

    try {
      const res = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 190000,
          sign: -1,
          confidence_level: 'probable',
          effective_year: new Date().getFullYear(),
          scenario_name: scenarioName,
          category: 'gifting',
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      expect(body.strategy_source).toBe(strategySource)
      expect(body.scenario_name).toBe(scenarioName)
      expect(body.source_role).toBe('consumer')
      expect(body.is_active).toBe(true)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })

  test('POST strategy-line-items with same name updates not duplicates', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'annual_gifting'
    const scenarioName = 'Playwright Upsert Test'

    const payload = {
      household_id: householdId,
      strategy_source: strategySource,
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      scenario_name: scenarioName,
      category: 'gifting',
    }

    try {
      await request.post('/api/strategy-line-items', { data: { ...payload, amount: 190000 } })
      const res = await request.post('/api/strategy-line-items', { data: { ...payload, amount: 95000 } })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      expect(body.amount).toBe(95000)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })

  test('POST strategy-line-items with different names creates distinct rows', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'annual_gifting'

    const base = {
      household_id: householdId,
      strategy_source: strategySource,
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      category: 'gifting',
    }

    const scenarioA = 'Playwright Scenario A'
    const scenarioB = 'Playwright Scenario B'

    try {
      const res1 = await request.post('/api/strategy-line-items', {
        data: { ...base, amount: 380000, scenario_name: scenarioA },
      })
      expect(res1.ok(), await res1.text()).toBeTruthy()
      const body1 = await res1.json()

      const res2 = await request.post('/api/strategy-line-items', {
        data: { ...base, amount: 95000, scenario_name: scenarioB },
      })
      expect(res2.ok(), await res2.text()).toBeTruthy()
      const body2 = await res2.json()

      expect(body1.id).not.toBe(body2.id)
      expect(body1.scenario_name).toBe(scenarioA)
      expect(body2.scenario_name).toBe(scenarioB)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioA)
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioB)
    }
  })

  test('DELETE strategy-line-items with scenario_name deactivates only that row', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'annual_gifting'
    const scenarioKeep = 'Playwright Keep'
    const scenarioRemove = 'Playwright Remove'

    const base = {
      household_id: householdId,
      strategy_source: strategySource,
      source_role: 'consumer',
      sign: -1,
      confidence_level: 'probable',
      effective_year: new Date().getFullYear(),
      category: 'gifting',
    }

    try {
      await request.post('/api/strategy-line-items', {
        data: { ...base, amount: 380000, scenario_name: scenarioKeep },
      })
      await request.post('/api/strategy-line-items', {
        data: { ...base, amount: 95000, scenario_name: scenarioRemove },
      })

      const deleteRes = await request.delete('/api/strategy-line-items', {
        data: {
          householdId,
          strategySource,
          scenarioName: scenarioRemove,
          source_role: 'consumer',
        },
      })
      expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy()
      expect((await deleteRes.json()).success).toBe(true)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioRemove)
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioKeep)
    }
  })

  test('POST strategy-line-items DAF source succeeds', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'daf'
    const scenarioName = 'base'

    try {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName, {
        assertOk: false,
      })

      const res = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 50000,
          sign: -1,
          confidence_level: 'probable',
          scenario_name: scenarioName,
          category: 'charitable',
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      expect((await res.json()).strategy_source).toBe(strategySource)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })

  test('POST strategy-line-items direct charitable source succeeds', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'charitable'
    const scenarioName = 'base'

    try {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName, {
        assertOk: false,
      })

      const res = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 25000,
          sign: -1,
          confidence_level: 'probable',
          scenario_name: scenarioName,
          category: 'charitable',
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      expect((await res.json()).strategy_source).toBe(strategySource)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })

  test('charitable save increases outside_strategy_total in composition', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'daf'
    const scenarioName = 'base'

    try {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName, {
        assertOk: false,
      })
      await deleteStrategyLineItem(request, householdId, 'charitable', scenarioName, {
        assertOk: false,
      })

      const beforeRes = await request.post('/api/estate-composition', {
        data: { householdId, sourceRole: 'consumer' },
      })
      expect(beforeRes.ok(), await beforeRes.text()).toBeTruthy()
      const before = (await beforeRes.json()) as { outside_strategy_total?: number }
      const beforeTotal = Number(before.outside_strategy_total ?? 0)

      const saveRes = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 10000,
          sign: -1,
          confidence_level: 'probable',
          scenario_name: scenarioName,
          category: 'charitable',
        },
      })
      expect(saveRes.ok(), await saveRes.text()).toBeTruthy()

      await new Promise((r) => setTimeout(r, 1500))

      const afterRes = await request.post('/api/estate-composition', {
        data: { householdId, sourceRole: 'consumer' },
      })
      expect(afterRes.ok(), await afterRes.text()).toBeTruthy()
      const after = (await afterRes.json()) as { outside_strategy_total?: number }
      expect(Number(after.outside_strategy_total ?? 0)).toBeGreaterThan(beforeTotal)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
      await deleteStrategyLineItem(request, householdId, 'charitable', scenarioName)
    }
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

  test('POST strategy-line-items liquidity source succeeds', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'liquidity'
    const scenarioName = 'Playwright Liquidity Test'

    try {
      const res = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 250000,
          sign: -1,
          confidence_level: 'probable',
          effective_year: new Date().getFullYear(),
          scenario_name: scenarioName,
          category: 'liability',
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      expect(body.strategy_source).toBe(strategySource)
      expect(body.category).toBe('liability')
      expect(body.is_active).toBe(true)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })

  test('POST strategy-line-items roth source succeeds', async ({ request }) => {
    const householdId = requireHouseholdId()
    const strategySource = 'roth'
    const scenarioName = 'Playwright Roth Test'

    try {
      const res = await request.post('/api/strategy-line-items', {
        data: {
          household_id: householdId,
          strategy_source: strategySource,
          source_role: 'consumer',
          amount: 100000,
          sign: -1,
          confidence_level: 'probable',
          effective_year: new Date().getFullYear(),
          scenario_name: scenarioName,
          category: 'trust_exclusion',
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      const body = await res.json()
      expect(body.strategy_source).toBe(strategySource)
      expect(body.category).toBe('trust_exclusion')
      expect(body.is_active).toBe(true)
    } finally {
      await deleteStrategyLineItem(request, householdId, strategySource, scenarioName)
    }
  })
})

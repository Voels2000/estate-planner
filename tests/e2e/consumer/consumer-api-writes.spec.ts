import { test, expect } from '@playwright/test'

/**
 * Smoke tests for consumer write APIs (auth via consumer-setup storage state).
 * Verifies routes accept authenticated requests and return success — not full recompute side effects.
 */
test.describe('Consumer write APIs', () => {
  test('PATCH allocation-targets accepts valid mix', async ({ request }) => {
    const res = await request.patch('/api/consumer/allocation-targets', {
      data: {
        target_stocks_pct: 55,
        target_bonds_pct: 35,
        target_cash_pct: 10,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.target_stocks_pct).toBe(55)
    expect(body.target_bonds_pct).toBe(35)
    expect(body.target_cash_pct).toBe(10)
  })

  test('PATCH allocation-targets rejects invalid sum', async ({ request }) => {
    const res = await request.patch('/api/consumer/allocation-targets', {
      data: {
        target_stocks_pct: 50,
        target_bonds_pct: 30,
        target_cash_pct: 30,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('PUT estate-health-check accepts complete answers', async ({ request }) => {
    const res = await request.put('/api/consumer/estate-health-check', {
      data: {
        answers: {
          has_will: 'yes',
          has_trust: 'no',
          has_poa: 'yes',
          has_hcd: 'yes',
          beneficiaries_current: 'yes',
        },
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('POST generate-base-case when household id provided', async ({ request }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    test.skip(!householdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID to run generate-base-case smoke')

    const res = await request.post('/api/consumer/generate-base-case', {
      data: { householdId },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.scenarioId).toBeTruthy()
  })
})

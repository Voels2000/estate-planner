import { test, expect } from '@playwright/test'

/**
 * Smoke tests for consumer financial write APIs (normalized Pattern C routes).
 * Covers: assets, income, expenses, real-estate, liabilities CRUD.
 * Verifies routes accept authenticated requests and return correct shape.
 *
 * These test the Session 100-103 normalization work.
 * All routes use afterHouseholdWrite server-side — no client fireRecompute.
 */

test.describe('Consumer financial write APIs — assets', () => {
  let createdAssetId: string | null = null

  test('POST /api/consumer/assets creates an asset', async ({ request }) => {
    const res = await request.post('/api/consumer/assets', {
      data: {
        type: 'financial_account',
        name: 'Playwright Test Asset',
        value: 50000,
        owner: 'person1',
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.name).toBe('Playwright Test Asset')
    expect(body.value).toBe(50000)
    createdAssetId = body.id
  })

  test('PATCH /api/consumer/assets updates an asset', async ({ request }) => {
    // Create first
    const createRes = await request.post('/api/consumer/assets', {
      data: {
        type: 'financial_account',
        name: 'Playwright Patch Test',
        value: 10000,
        owner: 'person1',
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    const created = await createRes.json()

    // Update
    const res = await request.patch('/api/consumer/assets', {
      data: {
        id: created.id,
        type: 'financial_account',
        name: 'Playwright Patch Test',
        value: 20000,
        owner: 'person1',
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.value).toBe(20000)

    // Cleanup
    await request.delete('/api/consumer/assets', { data: { id: created.id } })
  })

  test('DELETE /api/consumer/assets removes an asset', async ({ request }) => {
    // Create first
    const createRes = await request.post('/api/consumer/assets', {
      data: {
        type: 'financial_account',
        name: 'Playwright Delete Test',
        value: 1000,
        owner: 'person1',
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    const created = await createRes.json()

    // Delete
    const res = await request.delete('/api/consumer/assets', {
      data: { id: created.id },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('POST /api/consumer/assets rejects missing required fields', async ({ request }) => {
    const res = await request.post('/api/consumer/assets', {
      data: { owner: 'person1' }, // missing type, name, value
    })
    expect(res.status()).toBe(400)
  })

  test.afterAll(async ({ request }) => {
    // Clean up the asset from the first test if it exists
    if (createdAssetId) {
      await request.delete('/api/consumer/assets', { data: { id: createdAssetId } })
    }
  })
})

test.describe('Consumer financial write APIs — income', () => {
  test('POST /api/consumer/income creates an income source', async ({ request }) => {
    const res = await request.post('/api/consumer/income', {
      data: {
        source: 'employment',
        amount: 120000,
        start_year: new Date().getFullYear(),
        inflation_adjust: true,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.amount).toBe(120000)

    // Cleanup
    if (body.id) {
      await request.delete('/api/consumer/income', { data: { id: body.id } })
    }
  })

  test('POST /api/consumer/income rejects missing required fields', async ({ request }) => {
    const res = await request.post('/api/consumer/income', {
      data: { inflation_adjust: true }, // missing source, amount
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Consumer financial write APIs — expenses', () => {
  test('POST /api/consumer/expenses creates an expense', async ({ request }) => {
    const res = await request.post('/api/consumer/expenses', {
      data: {
        category: 'housing',
        name: 'Playwright Test Expense',
        amount: 2000,
        start_year: new Date().getFullYear(),
        inflation_adjust: true,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.amount).toBe(2000)

    // Cleanup
    if (body.id) {
      await request.delete('/api/consumer/expenses', { data: { id: body.id } })
    }
  })
})

test.describe('Consumer financial write APIs — real estate', () => {
  test('POST /api/consumer/real-estate creates a property', async ({ request }) => {
    const res = await request.post('/api/consumer/real-estate', {
      data: {
        name: 'Playwright Test Property',
        current_value: 500000,
        is_primary_residence: false,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.current_value).toBe(500000)

    // Cleanup
    if (body.id) {
      await request.delete('/api/consumer/real-estate', { data: { id: body.id } })
    }
  })
})

test.describe('Consumer financial write APIs — liabilities', () => {
  test('POST /api/consumer/liabilities creates a liability', async ({ request }) => {
    const res = await request.post('/api/consumer/liabilities', {
      data: {
        type: 'mortgage',
        name: 'Playwright Test Mortgage',
        balance: 300000,
        monthly_payment: 2000,
        interest_rate: 6.5,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.balance).toBe(300000)

    // Cleanup
    if (body.id) {
      await request.delete('/api/consumer/liabilities', { data: { id: body.id } })
    }
  })

  test('POST /api/consumer/liabilities rejects missing required fields', async ({ request }) => {
    const res = await request.post('/api/consumer/liabilities', {
      data: { type: 'mortgage' }, // missing balance
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Consumer MC scenario API', () => {
  test('GET /api/monte-carlo/advisor-assumptions returns system defaults', async ({ request }) => {
    const res = await request.get('/api/monte-carlo/advisor-assumptions')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.systemDefaults).toBeTruthy()
    expect(body.systemDefaults.returnMeanPct).toBe(6.5)
    expect(body.systemDefaults.withdrawalRatePct).toBe(4)
    // acceptedScenario is null when no advisor has shared one
    expect('acceptedScenario' in body).toBeTruthy()
    expect('latestSharedScenario' in body).toBeTruthy()
  })

  test('PATCH /api/monte-carlo/advisor-assumptions revert works when nothing accepted', async ({ request }) => {
    const res = await request.patch('/api/monte-carlo/advisor-assumptions', {
      data: { action: 'revert' },
    })
    // Should succeed even if nothing was accepted (idempotent)
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.reverted).toBe(true)
    expect(body.systemDefaults).toBeTruthy()
  })
})

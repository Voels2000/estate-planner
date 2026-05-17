import { test, expect } from '@playwright/test'

/**
 * Smoke tests for /api/consumer/trusts (POST / PATCH / DELETE).
 * Creates a trust, patches its name, then deletes it.
 * Cleans up after itself — no persistent data left in David Chen's household.
 */

test.describe('Consumer trust CRUD API', () => {
  test('POST /api/consumer/trusts creates a trust', async ({ request }) => {
    const res = await request.post('/api/consumer/trusts', {
      data: {
        name: 'Playwright Test Trust',
        trust_type: 'revocable',
        grantor: 'David Chen',
        trustee: 'Jane Chen',
        funding_amount: 250000,
        state: 'NY',
        is_irrevocable: false,
        excludes_from_estate: false,
      },
    })
    expect(res.ok(), `POST failed: ${await res.text()}`).toBeTruthy()
    const body = await res.json()
    expect(body.name).toBe('Playwright Test Trust')
    expect(body.trust_type).toBe('revocable')
    expect(body.funding_amount).toBe(250000)
    expect(body.id).toBeTruthy()

    const deleteRes = await request.delete('/api/consumer/trusts', {
      data: { id: body.id },
    })
    expect(deleteRes.ok(), `Cleanup DELETE failed: ${await deleteRes.text()}`).toBeTruthy()
  })

  test('PATCH /api/consumer/trusts updates the trust name', async ({ request }) => {
    // Create first so we have an id to patch
    const createRes = await request.post('/api/consumer/trusts', {
      data: {
        name: 'Playwright Patch Source',
        trust_type: 'irrevocable',
        grantor: 'David Chen',
        trustee: 'Jane Chen',
        funding_amount: 100000,
        state: 'NY',
        is_irrevocable: true,
        excludes_from_estate: true,
      },
    })
    expect(createRes.ok(), `Setup POST failed: ${await createRes.text()}`).toBeTruthy()
    const { id } = await createRes.json()

    // Patch the name
    const patchRes = await request.patch('/api/consumer/trusts', {
      data: {
        id,
        name: 'Playwright Patched Trust',
        trust_type: 'irrevocable',
        grantor: 'David Chen',
        trustee: 'Jane Chen',
        funding_amount: 100000,
        state: 'NY',
        is_irrevocable: true,
        excludes_from_estate: true,
      },
    })
    expect(patchRes.ok(), `PATCH failed: ${await patchRes.text()}`).toBeTruthy()
    const patched = await patchRes.json()
    expect(patched.name).toBe('Playwright Patched Trust')

    // Clean up
    await request.delete('/api/consumer/trusts', {
      data: { id },
    })
  })

  test('DELETE /api/consumer/trusts removes the trust', async ({ request }) => {
    // Create first so we have an id to delete
    const createRes = await request.post('/api/consumer/trusts', {
      data: {
        name: 'Playwright Delete Target',
        trust_type: 'bypass',
        grantor: 'David Chen',
        trustee: 'Jane Chen',
        funding_amount: 50000,
        state: 'NY',
        is_irrevocable: false,
        excludes_from_estate: false,
      },
    })
    expect(createRes.ok(), `Setup POST failed: ${await createRes.text()}`).toBeTruthy()
    const { id } = await createRes.json()

    // Delete it
    const deleteRes = await request.delete('/api/consumer/trusts', {
      data: { id },
    })
    expect(deleteRes.ok(), `DELETE failed: ${await deleteRes.text()}`).toBeTruthy()
    expect((await deleteRes.json()).success).toBe(true)
  })

  test('POST /api/consumer/trusts rejects missing name with 400', async ({ request }) => {
    const res = await request.post('/api/consumer/trusts', {
      data: {
        trust_type: 'revocable',
        funding_amount: 0,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/consumer/trusts rejects invalid trust_type with 400', async ({ request }) => {
    const res = await request.post('/api/consumer/trusts', {
      data: {
        name: 'Bad Type Trust',
        trust_type: 'fake_type',
        funding_amount: 0,
      },
    })
    expect(res.status()).toBe(400)
  })
})

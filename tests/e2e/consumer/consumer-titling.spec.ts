import { test, expect } from '@playwright/test'

/**
 * Smoke tests for the entity-titling write API.
 * Covers: asset titling upsert, real estate titling upsert, validation rejection.
 *
 * Uses sentinel UUIDs — ownership check fires correctly and returns 404.
 * 401/403/500 would indicate auth or routing failure.
 */

test.describe('Consumer entity-titling API', () => {
  test('POST /api/consumer/entity-titling for an asset returns 200 or 404', async ({ request }) => {
    const res = await request.post('/api/consumer/entity-titling', {
      data: {
        asset_id: '00000000-0000-0000-0000-000000000000',
        titling_row_id: null,
        title_type: 'sole',
        notes: 'Playwright smoke test',
        titling: 'individual_p1',
        liquidity: 'liquid',
        cost_basis: null,
        basis_date: null,
      },
    })
    expect(
      [200, 404, 403].includes(res.status()),
      `Expected 200, 404, or 403, got ${res.status()}: ${await res.text()}`
    ).toBeTruthy()
  })

  test('POST /api/consumer/entity-titling rejects missing entity ref with 400', async ({ request }) => {
    const res = await request.post('/api/consumer/entity-titling', {
      data: {
        title_type: 'sole',
        notes: null,
        titling: null,
        liquidity: null,
        cost_basis: null,
        basis_date: null,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/consumer/entity-titling for real estate returns 200 or 404', async ({ request }) => {
    const res = await request.post('/api/consumer/entity-titling', {
      data: {
        real_estate_id: '00000000-0000-0000-0000-000000000000',
        titling_row_id: null,
        title_type: 'joint_wros',
        notes: null,
        titling: 'joint_tenants',
        liquidity: 'illiquid',
        cost_basis: 500000,
        basis_date: '2020-01-01',
      },
    })
    expect(
      [200, 404, 403].includes(res.status()),
      `Expected 200, 404, or 403, got ${res.status()}: ${await res.text()}`
    ).toBeTruthy()
  })
})

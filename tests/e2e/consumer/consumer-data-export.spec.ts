import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { fetchHouseholdIdByOwnerEmail } from '../helpers/e2e-households'
import { EXPORT_INPUT_TABLES } from '@/lib/access/inputComputedBoundary'

test.describe('Consumer data export', () => {
  test('GET /api/consumer/data-export returns only caller household inputs', async ({
    request,
  }) => {
    const res = await request.get('/api/consumer/data-export')
    expect(res.status()).toBe(200)

    const body = await res.text()
    const payload = JSON.parse(body) as {
      boundary: string
      household_id: string | null
      tables: Record<string, unknown[]>
    }

    expect(payload.boundary).toBe('EXPORT_INPUT_TABLES')
    expect(Object.keys(payload.tables).sort()).toEqual([...EXPORT_INPUT_TABLES].sort())

    const consumerHouseholdId =
      process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim() ||
      (await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email))

    if (!consumerHouseholdId) {
      test.skip(true, 'Run npm run seed:e2e for household id')
    }

    expect(payload.household_id).toBe(consumerHouseholdId)
  })

  test('unauthenticated GET returns 401', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await context.request.get('/api/consumer/data-export')
    expect(res.status()).toBe(401)
    await context.close()
  })
})

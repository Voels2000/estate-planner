import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { fetchHouseholdIdByOwnerEmail } from '../helpers/e2e-households'
import {
  EXPORT_ISOLATION_MARKER_A,
  EXPORT_ISOLATION_MARKER_B,
  seedExportIsolationMarkers,
} from '../helpers/export-isolation-fixture'
import { EXPORT_INPUT_TABLES } from '@/lib/access/inputComputedBoundary'

test.describe('Consumer data export', () => {
  test.beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return
    initSupabaseEnv()
    const consumerId = await findUserIdByEmail(E2E_IDENTITIES.consumer.email)
    const advisorClientId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
    if (!consumerId || !advisorClientId) return
    await seedExportIsolationMarkers(consumerId, advisorClientId)
  })

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

  test('export includes caller rows and excludes other consumer rows when both have data', async ({
    request,
  }) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY required to seed isolation markers')
    }

    const res = await request.get('/api/consumer/data-export')
    expect(res.status()).toBe(200)
    const body = await res.text()

    expect(body).toContain(EXPORT_ISOLATION_MARKER_A)
    expect(body).not.toContain(EXPORT_ISOLATION_MARKER_B)
  })

  test('unauthenticated GET returns 401', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await context.request.get('/api/consumer/data-export')
    expect(res.status()).toBe(401)
    await context.close()
  })
})

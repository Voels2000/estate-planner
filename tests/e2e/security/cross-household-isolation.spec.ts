/**
 * Cross-household IDOR matrix — consumer and advisor must not read foreign households.
 * Requires PLAYWRIGHT_HOUSEHOLD_ID (e2e-consumer) and seeded Michael Johnson client.
 */
import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { fetchHouseholdIdByOwnerEmail, fetchJohnsonHouseholdId } from '../helpers/e2e-households'

const API_TIMEOUT_MS = 30_000

function apiOpts() {
  return { timeout: API_TIMEOUT_MS }
}

/** Routes may return 403 (forbidden) or 404 (not found) for foreign households — both deny access. */
function expectAccessDenied(status: number) {
  expect([403, 404]).toContain(status)
}

test.describe.configure({ mode: 'serial' })

let consumerHouseholdId: string
let johnsonHouseholdId: string

test.beforeAll(async () => {
  consumerHouseholdId =
    process.env.PLAYWRIGHT_HOUSEHOLD_ID ??
    (await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)) ??
    ''
  johnsonHouseholdId = (await fetchJohnsonHouseholdId()) ?? ''

  if (!consumerHouseholdId || !johnsonHouseholdId) {
    throw new Error(
      'Missing household IDs — run npm run seed:e2e and set PLAYWRIGHT_HOUSEHOLD_ID in .env.test',
    )
  }
  expect(consumerHouseholdId).not.toBe(johnsonHouseholdId)
})

test.describe('Consumer isolation', () => {
  test.use({ storageState: '.auth/consumer.json' })

  test('POST gifting-summary on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: johnsonHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: johnsonHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${johnsonHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('GET documents/household on foreign household returns empty or forbidden', async ({
    request,
  }) => {
    const res = await request.get(`/api/documents/household/${johnsonHouseholdId}`, apiOpts())
    if (res.status() === 403) return
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.document_count ?? body.documents?.length ?? 0).toBe(0)
  })
})

test.describe('Advisor isolation', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST gifting-summary on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: consumerHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${consumerHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })
})

test.describe('Advisor allowed access', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST estate-composition on Johnson household returns 200', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: johnsonHouseholdId, sourceRole: 'advisor' },
    })
    expect(res.status(), await res.text()).toBe(200)
    const body = await res.json()
    expect(typeof body.gross_estate).toBe('number')
  })
})

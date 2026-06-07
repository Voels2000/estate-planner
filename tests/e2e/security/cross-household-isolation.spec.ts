/**
 * Cross-household IDOR matrix — consumer and advisor must not read foreign households.
 * Requires PLAYWRIGHT_HOUSEHOLD_ID (e2e-consumer) and seeded E2E advisor client.
 */
import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchAdvisorClientHouseholdId,
  fetchHouseholdIdByOwnerEmail,
} from '../helpers/e2e-households'

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
let advisorClientHouseholdId: string

test.beforeAll(async () => {
  consumerHouseholdId =
    process.env.PLAYWRIGHT_HOUSEHOLD_ID ??
    (await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)) ??
    ''
  advisorClientHouseholdId = (await fetchAdvisorClientHouseholdId()) ?? ''

  if (!consumerHouseholdId || !advisorClientHouseholdId) {
    throw new Error(
      'Missing household IDs — run npm run seed:e2e and set PLAYWRIGHT_HOUSEHOLD_ID in .env.test',
    )
  }
  expect(consumerHouseholdId).not.toBe(advisorClientHouseholdId)
})

test.describe('Consumer isolation', () => {
  test.use({ storageState: '.auth/consumer.json' })

  test('POST gifting-summary on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'consumer' },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${advisorClientHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('GET documents on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.get(`/api/documents/household/${advisorClientHouseholdId}`, apiOpts())
    expectAccessDenied(res.status())
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

test.describe('Advisor access to linked client', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST estate-composition on advisor client household returns 200', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'advisor' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
  })
})

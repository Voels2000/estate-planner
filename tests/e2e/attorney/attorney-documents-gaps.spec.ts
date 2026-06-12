/**
 * Attorney document vault + gap dismissals API smoke.
 * Links e2e attorney to consumer household via service role when needed.
 */
import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  ensureAttorneyClientLink,
  fetchHouseholdIdByOwnerEmail,
  grantAttorneyAccessViaConsumerApi,
} from '../helpers/e2e-households'

const API_TIMEOUT_MS = 30_000

function apiOpts() {
  return { timeout: API_TIMEOUT_MS }
}

test.describe.configure({ mode: 'serial' })

let linkedHouseholdId: string
const foreignHouseholdId = '00000000-0000-4000-8000-000000000099'
const gapKey = `e2e_gap_${Date.now()}`

test.beforeAll(async ({ playwright }) => {
  linkedHouseholdId =
    process.env.PLAYWRIGHT_HOUSEHOLD_ID ??
    (await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)) ??
    ''
  test.skip(!linkedHouseholdId, 'Set PLAYWRIGHT_HOUSEHOLD_ID or run seed:e2e')

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.mywealthmaps.com'
  let linked = await ensureAttorneyClientLink(linkedHouseholdId)
  if (!linked) {
    linked = await grantAttorneyAccessViaConsumerApi(playwright, baseURL)
  }
  expect(
    linked,
    'Could not link e2e attorney to consumer household — apply migration 20260630100000_attorney_clients_fk_listing_household.sql',
  ).toBe(true)
})

test('GET /api/documents/household/{id} returns document list for connected client', async ({
  request,
}) => {
  const res = await request.get(`/api/documents/household/${linkedHouseholdId}`, apiOpts())
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.documents)).toBe(true)
})

test('GET /api/documents/household/{id} on foreign household returns empty or forbidden', async ({
  request,
}) => {
  const res = await request.get(`/api/documents/household/${foreignHouseholdId}`, apiOpts())
  if (res.status() === 403) return
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  expect(body.document_count ?? body.documents?.length ?? 0).toBe(0)
})

test('POST /api/attorney/gap-dismissals succeeds for connected household', async ({ request }) => {
  const res = await request.post('/api/attorney/gap-dismissals', {
    ...apiOpts(),
    data: {
      household_id: linkedHouseholdId,
      gap_key: gapKey,
      note: 'E2E dismissal',
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)
})

test('POST /api/attorney/gap-dismissals on foreign household returns 403', async ({ request }) => {
  const res = await request.post('/api/attorney/gap-dismissals', {
    ...apiOpts(),
    data: {
      household_id: foreignHouseholdId,
      gap_key: 'foreign_gap',
    },
  })
  expect(res.status()).toBe(403)
})

test('PATCH /api/documents/{id}/status on missing doc returns 404', async ({ request }) => {
  const fakeDocId = '00000000-0000-4000-8000-000000000088'
  const res = await request.patch(`/api/documents/${fakeDocId}/status`, {
    ...apiOpts(),
    data: { doc_status: 'draft' },
  })
  expect(res.status()).toBe(404)
})

test('attorney dashboard lists linked consumer household', async ({ page }) => {
  await page.goto('/attorney')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(
    page.locator('main').getByRole('heading', { name: 'Attorney Portal' }),
  ).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.locator(`a[href="/attorney/clients/${linkedHouseholdId}"]`),
  ).toBeVisible({ timeout: 30_000 })
})

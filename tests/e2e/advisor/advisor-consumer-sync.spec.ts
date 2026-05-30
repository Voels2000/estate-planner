/**
 * Cross-role sync — Johnson client adds asset; advisor sees updated client workspace.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import { clickAdvisorClientTab, gotoMichaelJohnsonClient } from '../helpers/constants'
import { fetchJohnsonHouseholdId } from '../helpers/e2e-households'

const ASSETS_API = '/api/consumer/assets'
const API_TIMEOUT_MS = 30_000
const UNIQUE_NAME = `E2E Sync Asset ${Date.now()}`

test.describe.configure({ mode: 'serial', timeout: 120_000 })

let johnsonHouseholdId: string
let johnsonRequest: APIRequestContext
let createdAssetId: string | null = null

test.beforeAll(async ({ playwright }) => {
  johnsonHouseholdId = (await fetchJohnsonHouseholdId()) ?? ''
  test.skip(!johnsonHouseholdId, 'Michael Johnson household missing — run npm run seed:e2e')

  johnsonRequest = await playwright.request.newContext({
    storageState: '.auth/johnson-client.json',
  })
})

test.afterAll(async () => {
  if (createdAssetId) {
    await johnsonRequest.delete(ASSETS_API, { data: { id: createdAssetId } })
  }
  await johnsonRequest.dispose()
})

test('Johnson POST asset then advisor reads updated estate composition', async ({ page }) => {
  const createRes = await johnsonRequest.post(ASSETS_API, {
    timeout: API_TIMEOUT_MS,
    data: {
      type: 'financial_account',
      name: UNIQUE_NAME,
      value: 25_000,
      owner: 'person1',
    },
  })
  expect(createRes.ok(), await createRes.text()).toBeTruthy()
  const created = (await createRes.json()) as { id: string }
  createdAssetId = created.id

  const compositionRes = await page.request.post('/api/estate-composition', {
    timeout: API_TIMEOUT_MS,
    data: {
      householdId: johnsonHouseholdId,
      sourceRole: 'advisor',
    },
  })
  expect(compositionRes.ok(), await compositionRes.text()).toBeTruthy()
  const composition = await compositionRes.json()
  expect(composition.gross_estate).toBeGreaterThan(0)

  await gotoMichaelJohnsonClient(page)
  await clickAdvisorClientTab(page, /Strategy/)
  await expect(page.getByRole('button', { name: 'Run Monte Carlo' })).toBeVisible({
    timeout: 30_000,
  })
})

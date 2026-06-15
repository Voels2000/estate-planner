/**
 * Route-level negative authorization — admin surfaces and role boundaries.
 * Tagged @authz @production for prod smoke subset.
 */
import { test, expect } from '@playwright/test'

const API_TIMEOUT_MS = 30_000

function apiOpts() {
  return { timeout: API_TIMEOUT_MS }
}

test.describe('@production @authz', () => {
  test.describe('Admin routes', () => {
    test('GET verify-env without token returns 404', async ({ request }) => {
      const res = await request.get('/api/admin/verify-env', apiOpts())
      expect(res.status()).toBe(404)
    })

    test('GET verify-env with wrong token returns 404', async ({ request }) => {
      const res = await request.get('/api/admin/verify-env', {
        ...apiOpts(),
        headers: { 'x-admin-token': 'invalid-token-for-authz-test' },
      })
      expect(res.status()).toBe(404)
    })
  })

  test.describe('Consumer role boundaries', () => {
    test.use({ storageState: '.auth/consumer.json' })

    test('consumer cannot fetch advisor strategy-tab', async ({ request }) => {
      const res = await request.get(
        `/api/advisor/strategy-tab?clientId=${encodeURIComponent('00000000-0000-4000-8000-000000000099')}`,
        apiOpts(),
      )
      expect([401, 403, 404]).toContain(res.status())
    })
  })
})

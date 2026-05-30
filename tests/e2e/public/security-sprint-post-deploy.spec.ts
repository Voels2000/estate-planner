/**
 * Post-deploy security sprint smoke — public API checks.
 * Manual equivalents: DevTools on /event/* and logged-out tab (no login required).
 *
 * Run: npx playwright test tests/e2e/public/security-sprint-post-deploy.spec.ts --project=public
 */
import { test, expect } from '@playwright/test'

test.describe('Security sprint — public API smoke', () => {
  test('referral track rate-limits after ~60 requests', async ({ request }) => {
    test.setTimeout(120_000)

    const statuses: number[] = []
    for (let i = 0; i < 65; i++) {
      const res = await request.post('/api/referral/track', {
        data: { ref: 'test123' },
      })
      statuses.push(res.status())
    }

    const counts = statuses.reduce<Record<number, number>>((acc, s) => {
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {})

    expect((counts[200] ?? 0) + (counts[400] ?? 0)).toBeGreaterThanOrEqual(55)
    expect(counts[429] ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('telemetry endpoint requires auth (401)', async ({ request }) => {
    const res = await request.post('/api/telemetry/horizon-input-missing', {
      data: { test: true },
    })
    expect(res.status()).toBe(401)
  })
})

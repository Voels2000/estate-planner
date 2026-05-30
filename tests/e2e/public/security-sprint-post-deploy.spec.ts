/**
 * Post-deploy security sprint smoke — public API checks.
 * Manual equivalents: DevTools on /event/* and logged-out tab (no login required).
 *
 * Uses production for API requests: preview deployments (vercel.app) often serve pages
 * but POST /api/* routes do not respond within test timeouts.
 *
 * Run: npm run test:e2e:security-smoke
 */
import { test, expect, type APIRequestContext } from '@playwright/test'

const API_REQUEST_TIMEOUT_MS = 20_000

/** Production marketing domain — post-deploy API smoke target. */
const PUBLIC_API_BASE_URL =
  process.env.PLAYWRIGHT_PUBLIC_API_BASE_URL ?? 'https://www.mywealthmaps.com'

async function postPublicApi(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<Awaited<ReturnType<APIRequestContext['post']>>> {
  const url = `${PUBLIC_API_BASE_URL.replace(/\/$/, '')}${path}`
  return request.post(url, {
    data,
    timeout: API_REQUEST_TIMEOUT_MS,
  })
}

test.describe('Security sprint — public API smoke', () => {
  test('referral track rate-limits after ~60 requests', async ({ request }) => {
    test.setTimeout(180_000)

    let probe: Awaited<ReturnType<APIRequestContext['post']>>
    try {
      probe = await postPublicApi(request, '/api/referral/track', { ref: 'test123' })
    } catch {
      test.skip(
        true,
        `API unreachable at ${PUBLIC_API_BASE_URL} — check deployment or set PLAYWRIGHT_PUBLIC_API_BASE_URL`,
      )
      return
    }

    const statuses: number[] = [probe.status()]
    for (let i = 1; i < 65; i++) {
      const res = await postPublicApi(request, '/api/referral/track', { ref: 'test123' })
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
    test.setTimeout(30_000)

    let res: Awaited<ReturnType<APIRequestContext['post']>>
    try {
      res = await postPublicApi(request, '/api/telemetry/horizon-input-missing', {
        test: true,
      })
    } catch {
      test.skip(
        true,
        `API unreachable at ${PUBLIC_API_BASE_URL} — deploy telemetry route fix or check network`,
      )
      return
    }
    expect(res.status()).toBe(401)
  })
})

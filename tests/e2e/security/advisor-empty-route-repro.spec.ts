/**
 * Local repro for advisor-empty client-export 401 intermittency.
 *
 * Standalone loop: hammer the route with advisor-empty storage only.
 * After-consumer loop: same consumer preflight as cross-household-isolation serial
 * block, then hammer advisor-empty — bisects serial-mode / request-context timing.
 *
 * Run:
 *   npm run test:e2e:advisor-empty-route-repro
 *
 * With CI tarball auth (after unpack):
 *   E2E_REUSE_AUTH=1 E2E_SUITE=security-isolation npm run test:e2e:advisor-empty-route-repro
 *
 * Iterations (default 50):
 *   E2E_ADVISOR_EMPTY_REPRO_N=50 npm run test:e2e:advisor-empty-route-repro
 */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchAdvisorClientHouseholdId,
} from '../helpers/e2e-households'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { authStoragePath } from '../helpers/e2e-auth-storage'

const API_TIMEOUT_MS = 30_000
const REPRO_ITERATIONS = Number(process.env.E2E_ADVISOR_EMPTY_REPRO_N ?? 50)
const ADVISOR_EMPTY_STORAGE = '.auth/advisor-empty.json'

function apiOpts() {
  return { timeout: API_TIMEOUT_MS }
}

type StatusCounts = Record<number, number>

function countStatus(counts: StatusCounts, status: number) {
  counts[status] = (counts[status] ?? 0) + 1
}

function summarizeCounts(counts: StatusCounts, total: number) {
  return {
    total,
    byStatus: counts,
    count401: counts[401] ?? 0,
    count403: counts[403] ?? 0,
    count404: counts[404] ?? 0,
    countOther: total - (counts[401] ?? 0) - (counts[403] ?? 0) - (counts[404] ?? 0),
  }
}

async function hitClientExportRoute(
  request: { get: (url: string, opts?: { timeout?: number }) => Promise<{ status: () => number }> },
  clientId: string,
): Promise<number> {
  const res = await request.get(
    `/api/advisor/client-export-payload?clientId=${clientId}`,
    apiOpts(),
  )
  return res.status()
}

async function loopAdvisorEmptyRoute(
  request: Parameters<typeof hitClientExportRoute>[0],
  clientId: string,
  iterations: number,
): Promise<ReturnType<typeof summarizeCounts>> {
  const counts: StatusCounts = {}
  for (let i = 0; i < iterations; i++) {
    countStatus(counts, await hitClientExportRoute(request, clientId))
  }
  return summarizeCounts(counts, iterations)
}

/** Mirrors the Consumer isolation block order in cross-household-isolation.spec.ts. */
async function runConsumerIsolationPreflight(
  request: {
    post: (
      url: string,
      opts: { timeout?: number; data?: unknown },
    ) => Promise<{ status: () => number }>
    get: (url: string, opts?: { timeout?: number }) => Promise<{ status: () => number }>
  },
  advisorClientHouseholdId: string,
) {
  await request.post('/api/gifting-summary', {
    ...apiOpts(),
    data: { householdId: advisorClientHouseholdId },
  })
  await request.post('/api/estate-composition', {
    ...apiOpts(),
    data: { householdId: advisorClientHouseholdId, sourceRole: 'consumer' },
  })
  await request.get(
    `/api/export-estate-plan?household_id=${advisorClientHouseholdId}`,
    apiOpts(),
  )
  await request.get(`/api/documents/household/${advisorClientHouseholdId}`, apiOpts())
  await request.get('/api/consumer/data-export', apiOpts())
}

let advisorClientOwnerUserId = ''
let advisorClientHouseholdId = ''

test.beforeAll(async ({}, testInfo) => {
  if (!fs.existsSync(ADVISOR_EMPTY_STORAGE)) {
    testInfo.skip(true, `Missing ${ADVISOR_EMPTY_STORAGE} — run advisor-empty-setup or unpack CI tarball`)
    return
  }

  const canAdminLookup =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

  advisorClientHouseholdId = process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID?.trim() ?? ''

  if (canAdminLookup) {
    initSupabaseEnv()
    advisorClientHouseholdId =
      (await fetchAdvisorClientHouseholdId()) ?? advisorClientHouseholdId
    advisorClientOwnerUserId =
      (await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)) ?? ''
  }

  if (!advisorClientOwnerUserId) {
    testInfo.skip(true, 'advisor-client owner user id unavailable — seed:e2e or service role')
  }
})

test.describe('Advisor-empty route repro @repro', () => {
  test.use({ storageState: ADVISOR_EMPTY_STORAGE })

  test(`standalone: client-export GET × ${REPRO_ITERATIONS}`, async ({ request }) => {
    const summary = await loopAdvisorEmptyRoute(request, advisorClientOwnerUserId, REPRO_ITERATIONS)
    const payload = { scenario: 'standalone', iterations: REPRO_ITERATIONS, ...summary }
    console.log(`[advisor-empty-route-repro] ${JSON.stringify(payload)}`)
    test.info().annotations.push({ type: 'repro-summary', description: JSON.stringify(payload) })
    expect(summary.count401, `standalone: ${summary.count401}/${summary.total} returned 401`).toBe(0)
  })
})

test.describe('Advisor-empty route repro after consumer preflight @repro', () => {
  /**
   * Single test: consumer preflight then advisor-empty loop without a test boundary.
   * Consumer request context stays open during the advisor loop (same worker, same Next
   * server process) — matches serial-block server-side sequencing more closely than
   * splitting across two tests with disposed contexts.
   */
  test(`after consumer preflight (same worker): client-export GET × ${REPRO_ITERATIONS}`, async ({
    playwright,
  }) => {
    test.skip(!advisorClientHouseholdId, 'advisor client household ID unavailable')

    const consumerCtx = await playwright.request.newContext({
      storageState: authStoragePath('consumer'),
    })
    const advisorEmptyCtx = await playwright.request.newContext({
      storageState: ADVISOR_EMPTY_STORAGE,
    })
    try {
      await runConsumerIsolationPreflight(consumerCtx, advisorClientHouseholdId)
      const summary = await loopAdvisorEmptyRoute(
        advisorEmptyCtx,
        advisorClientOwnerUserId,
        REPRO_ITERATIONS,
      )
      const payload = {
        scenario: 'after-consumer-preflight',
        sameWorkerSingleTest: true,
        consumerCtxOpenDuringLoop: true,
        iterations: REPRO_ITERATIONS,
        ...summary,
      }
      console.log(`[advisor-empty-route-repro] ${JSON.stringify(payload)}`)
      test.info().annotations.push({ type: 'repro-summary', description: JSON.stringify(payload) })
      expect(
        summary.count401,
        `after-consumer-preflight: ${summary.count401}/${summary.total} returned 401`,
      ).toBe(0)
    } finally {
      await consumerCtx.dispose()
      await advisorEmptyCtx.dispose()
    }
  })
})

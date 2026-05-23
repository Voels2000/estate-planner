import { test, expect, type Page } from '@playwright/test'
import { fetchEstateHealthComputedAt, pollComputedAtChanged } from '../helpers/estate-health-poll'

const ASSETS_API = '/api/consumer/assets'
const ASSET_NAME = 'Smoke Test CD'
const ASSET_VALUE = 10_000

function parseMoney(text: string | null): number {
  if (!text) return 0
  const n = Number(text.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

async function assertDashboardNonZeroNetWorthOrReadiness(page: Page) {
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible({ timeout: 20_000 })

  const netWorthAmount = page
    .locator('p')
    .filter({ hasText: /^Net Worth$/ })
    .locator('..')
    .locator('p.text-4xl')
  if (await netWorthAmount.isVisible()) {
    const value = parseMoney(await netWorthAmount.textContent())
    if (value > 0) return
  }

  const estateSummary = page.getByRole('button', { name: /Estate Summary/i })
  if (await estateSummary.isVisible()) {
    await estateSummary.click()
  }

  const readinessScore = page
    .locator('p')
    .filter({ hasText: /^Estate Readiness Score$/ })
    .locator('..')
    .locator('span.text-5xl')
    .first()
  if (await readinessScore.isVisible()) {
    const score = Number((await readinessScore.textContent())?.trim())
    expect(score, 'Estate readiness score should be > 0').toBeGreaterThan(0)
    return
  }

  throw new Error(
    'Dashboard did not show non-zero net worth or estate readiness score after asset save',
  )
}

/**
 * CONSUMER_RELEASE_SMOKE_TEST.md §2 — financial save + recompute.
 * Requires PLAYWRIGHT_HOUSEHOLD_ID, NEXT_PUBLIC_SUPABASE_ANON_KEY, and working
 * RECOMPUTE_SECRET on the target deployment (afterHouseholdWrite).
 */
test.describe('Consumer core recompute (smoke §2)', () => {
  test('POST asset advances computed_at and dashboard shows financial data', async ({
    request,
    page,
  }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    test.skip(
      !householdId || !anonKey,
      'Set PLAYWRIGHT_HOUSEHOLD_ID and NEXT_PUBLIC_SUPABASE_ANON_KEY for recompute verification',
    )

    const computedBefore = await fetchEstateHealthComputedAt(request, householdId!)

    const createRes = await request.post(ASSETS_API, {
      data: {
        type: 'financial_account',
        name: `${ASSET_NAME} ${Date.now()}`,
        value: ASSET_VALUE,
        owner: 'person1',
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    const created = (await createRes.json()) as { id: string }

    try {
      const computedAfter = await pollComputedAtChanged(request, householdId!, computedBefore, {
        timeoutMs: 15_000,
        intervalMs: 1000,
        errorMessage:
          'estate_health_scores.computed_at did not change after POST /api/consumer/assets',
      })
      expect(computedAfter).toBeTruthy()

      await assertDashboardNonZeroNetWorthOrReadiness(page)
    } finally {
      // Always tear down — even when poll/dashboard assert throws — so manual smoke baselines stay clean.
      await request.delete(ASSETS_API, { data: { id: created.id } })
    }
  })
})

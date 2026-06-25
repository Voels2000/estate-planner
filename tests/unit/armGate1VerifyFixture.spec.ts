import { test, expect } from '@playwright/test'
import { isProjectionStale } from '@/lib/projections/staleness'
import { ONRAMP_SCORE_THRESHOLD, shouldShowOnramp } from '@/lib/dashboard/onrampGate'

test.describe('armGate1VerifyFixture', () => {
  test('null base case + fresh household input is stale and reaches completed dashboard', () => {
    const now = Date.now()
    const staleInputAt = new Date(now).toISOString()

    const armed = {
      baseCaseScenarioId: null as string | null,
      projectionCalculatedAt: null as string | null,
      armedInputChangeMs: now,
    }

    expect(
      isProjectionStale({
        baseCaseScenarioId: armed.baseCaseScenarioId,
        projectionCalculatedAt: armed.projectionCalculatedAt,
        latestInputChangeMs: armed.armedInputChangeMs,
      }),
    ).toBe(true)

    expect(
      shouldShowOnramp({
        wizardCompletedAt: staleInputAt,
        foundationScore: ONRAMP_SCORE_THRESHOLD,
        hasAnyHouseholdData: true,
      }),
    ).toBe(false)
  })

  test('old projection + newer input is stale', () => {
    const now = Date.now()
    const oldProjection = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

    expect(
      isProjectionStale({
        baseCaseScenarioId: 'scenario-1',
        projectionCalculatedAt: oldProjection,
        latestInputChangeMs: now,
      }),
    ).toBe(true)
  })
})

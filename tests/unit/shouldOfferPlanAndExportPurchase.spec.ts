/**
 * Plan & Export buy CTA visibility — canDownloadDeliverable computed via loader wiring
 * (same chain as print/page.tsx), not hand-passed booleans.
 *
 * Run: npx playwright test tests/unit/shouldOfferPlanAndExportPurchase.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  mockCompletedPlanExportRow,
  offerPlanAndExportWithGateWiring,
  printPageDeliverableFlags,
} from './helpers/printPageDeliverableWiring'

const tier1NoSub = {
  role: 'consumer',
  consumer_tier: 1,
  subscription_status: 'none',
} as const

const appTrialStoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 0,
  subscription_status: 'none' as const,
}

test.describe('shouldOfferPlanAndExportPurchase (gate-wired)', () => {
  test('offers buy when loader row null and no paid sub', () => {
    expect(offerPlanAndExportWithGateWiring(tier1NoSub, null)).toBe(true)
    expect(printPageDeliverableFlags(tier1NoSub, null).showPlanAndExportOffer).toBe(true)
  })

  test('hides buy when active tier-3 sub grants download via gate', () => {
    const activeTier3 = {
      role: 'consumer' as const,
      consumer_tier: 3,
      subscription_status: 'active' as const,
    }
    expect(offerPlanAndExportWithGateWiring(activeTier3, null)).toBe(false)
    expect(printPageDeliverableFlags(activeTier3, null).canDownloadDeliverable).toBe(true)
  })

  test('hides buy when completed loader row grants download (mid edit window)', () => {
    expect(offerPlanAndExportWithGateWiring(tier1NoSub, mockCompletedPlanExportRow())).toBe(
      false,
    )
    expect(
      printPageDeliverableFlags(tier1NoSub, mockCompletedPlanExportRow()).canDownloadDeliverable,
    ).toBe(true)
  })

  test('hides buy for advisor-linked client even when gate is closed', () => {
    expect(
      offerPlanAndExportWithGateWiring(tier1NoSub, null, { isAdvisorClient: true }),
    ).toBe(false)
  })

  test('hides buy for advisor-managed consumer', () => {
    expect(
      offerPlanAndExportWithGateWiring(
        { ...tier1NoSub, subscription_status: 'advisor_managed' },
        null,
        { subscription_plan: 'advisor_managed' },
      ),
    ).toBe(false)
  })

  test('hides buy for non-consumer roles', () => {
    expect(
      offerPlanAndExportWithGateWiring(
        { role: 'advisor', consumer_tier: 3, subscription_status: 'active' },
        null,
      ),
    ).toBe(false)
  })

  test('shows buy for app-managed trial stored profile (effective tier 3, no deliverable access)', () => {
    expect(offerPlanAndExportWithGateWiring(appTrialStoredProfile, null)).toBe(true)
    expect(printPageDeliverableFlags(appTrialStoredProfile, null).showPlanAndExportOffer).toBe(
      true,
    )
    expect(printPageDeliverableFlags(appTrialStoredProfile, null).canDownloadDeliverable).toBe(
      false,
    )
  })

  test('hides buy for Plan & Export purchaser via loader row (no active sub)', () => {
    expect(offerPlanAndExportWithGateWiring(tier1NoSub, mockCompletedPlanExportRow())).toBe(
      false,
    )
  })
})

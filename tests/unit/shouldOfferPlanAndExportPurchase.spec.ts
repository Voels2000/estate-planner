/**
 * Plan & Export buy CTA visibility — must track hasDeliverableDownloadAccess gate.
 * Run: npx playwright test tests/unit/shouldOfferPlanAndExportPurchase.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { shouldOfferPlanAndExportPurchase } from '../../lib/billing/shouldOfferPlanAndExportPurchase'

const tier1NoSub = {
  role: 'consumer',
  consumer_tier: 1,
  subscription_status: 'none',
} as const

test.describe('shouldOfferPlanAndExportPurchase', () => {
  test('offers buy when gate says no download access', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: tier1NoSub,
        canDownloadDeliverable: false,
        isAdvisorClient: false,
      }),
    ).toBe(true)
  })

  test('hides buy when gate says download allowed (active tier-3 sub)', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: {
          ...tier1NoSub,
          consumer_tier: 3,
          subscription_status: 'active',
        },
        canDownloadDeliverable: true,
        isAdvisorClient: false,
      }),
    ).toBe(false)
  })

  test('hides buy when gate says download allowed (any purchase, including post-window)', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: tier1NoSub,
        canDownloadDeliverable: true,
        isAdvisorClient: false,
      }),
    ).toBe(false)
  })

  test('hides buy for advisor-linked client even when gate is closed', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: tier1NoSub,
        canDownloadDeliverable: false,
        isAdvisorClient: true,
      }),
    ).toBe(false)
  })

  test('hides buy for advisor-managed consumer', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: {
          ...tier1NoSub,
          subscription_status: 'advisor_managed',
        },
        canDownloadDeliverable: false,
        isAdvisorClient: false,
        subscription_plan: 'advisor_managed',
      }),
    ).toBe(false)
  })

  test('hides buy for non-consumer roles', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: {
          role: 'advisor',
          consumer_tier: 3,
          subscription_status: 'active',
        },
        canDownloadDeliverable: false,
        isAdvisorClient: false,
      }),
    ).toBe(false)
  })

  test('shows buy for app-managed trial user (effective tier 3, no deliverable access)', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: {
          role: 'consumer',
          consumer_tier: 0,
          subscription_status: 'none',
        },
        canDownloadDeliverable: false,
        isAdvisorClient: false,
      }),
    ).toBe(true)
  })

  test('hides buy for Plan & Export purchaser (canDownloadDeliverable true, no active sub)', () => {
    expect(
      shouldOfferPlanAndExportPurchase({
        profile: {
          role: 'consumer',
          consumer_tier: 1,
          subscription_status: 'none',
        },
        canDownloadDeliverable: true,
        isAdvisorClient: false,
      }),
    ).toBe(false)
  })
})

/**
 * ONE_TIME_SKUS registry — amount derivation + PRICE_ID_TO_TIER isolation.
 * Run: npx playwright test tests/unit/stripeOneTimeSkus.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { planAndExportAmountCents } from '../../lib/billing/oneTimePurchases'
import {
  __resetStripePriceCachesForTests,
  buildPriceIdToTierMap,
  isPlanAndExportPriceId,
} from '../../lib/billing/stripePrices'

test('derives amountCents from estate annual total', () => {
  expect(planAndExportAmountCents()).toBe(790 * 100)
})

test('keeps one-time price out of PRICE_ID_TO_TIER when env is set', () => {
  const priceId = 'price_plan_and_export_test'
  process.env.STRIPE_PRICE_PLAN_AND_EXPORT = priceId
  __resetStripePriceCachesForTests()

  const map = buildPriceIdToTierMap()
  expect(map[priceId]).toBeUndefined()
  expect(isPlanAndExportPriceId(priceId)).toBe(true)

  delete process.env.STRIPE_PRICE_PLAN_AND_EXPORT
  __resetStripePriceCachesForTests()
})

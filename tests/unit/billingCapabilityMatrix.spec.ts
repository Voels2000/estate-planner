import { test, expect } from '@playwright/test'
import {
  BILLING_CAPABILITY_ROWS,
  isBillingCapabilityIncluded,
  resolveRowMinTierFromFeatures,
} from '@/lib/billing/billingCapabilityMatrix'
import { FEATURE_TIERS } from '@/lib/tiers'

test.describe('billingCapabilityMatrix', () => {
  test('cumulative checks march by tier', () => {
    const row = BILLING_CAPABILITY_ROWS.find((r) => r.featureKeys.includes('monte-carlo'))!
    expect(isBillingCapabilityIncluded(row, 0)).toBe(false)
    expect(isBillingCapabilityIncluded(row, 1)).toBe(false)
    expect(isBillingCapabilityIncluded(row, 2)).toBe(true)
    expect(isBillingCapabilityIncluded(row, 3)).toBe(true)
  })

  test('free floor rows included at tier 0', () => {
    const netWorth = BILLING_CAPABILITY_ROWS.find((r) =>
      r.featureKeys.includes('net-worth-view'),
    )!
    expect(isBillingCapabilityIncluded(netWorth, 0)).toBe(true)
  })

  test('paid row minTier matches FEATURE_TIERS max for listed keys', () => {
    for (const row of BILLING_CAPABILITY_ROWS) {
      if (row.minTier === 0) continue
      const keysInGate = row.featureKeys.filter((k) => FEATURE_TIERS[k] != null)
      if (keysInGate.length === 0) continue
      const fromFeatures = resolveRowMinTierFromFeatures(row)
      expect(fromFeatures).toBe(row.minTier)
    }
  })

  test('tier 0 rows use planned keys not yet in FEATURE_TIERS', () => {
    const exportRow = BILLING_CAPABILITY_ROWS.find((r) =>
      r.featureKeys.includes('data-export'),
    )!
    expect(FEATURE_TIERS['data-export']).toBeUndefined()
    expect(exportRow.minTier).toBe(0)
  })
})

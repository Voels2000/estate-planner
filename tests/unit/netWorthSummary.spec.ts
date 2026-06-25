import { test, expect } from '@playwright/test'
import { buildNetWorthSummaryFromDashboardInput } from '@/lib/view-models/netWorthSummary'
import type { EstateComposition } from '@/lib/estate/types'

/**
 * Net-worth floor must include RE equity and business value from input tables /
 * composition engine — independent of gated analysis surfaces (real-estate-analysis,
 * business-succession-analysis).
 */
test.describe('buildNetWorthSummaryFromDashboardInput', () => {
  test('composition path: real-estate FMV minus mortgage contributes equity to net worth', () => {
    const composition = {
      inside_financial: 500_000,
      inside_real_estate: 1_000_000,
      inside_business_gross: 0,
      inside_insurance: 0,
      gross_estate: 1_500_000,
      total_liabilities: 200_000,
      net_estate: 1_300_000,
    } as EstateComposition

    const summary = buildNetWorthSummaryFromDashboardInput({
      composition,
      financialAssetsFallback: 0,
      realEstateValueFallback: 0,
      businessValueFallback: 0,
      insuranceValueFallback: 0,
      mortgageBalance: 200_000,
      otherLiabilities: 0,
    })

    expect(summary.realEstateValue).toBe(1_000_000)
    expect(summary.netWorth).toBe(1_300_000)
  })

  test('composition path: business estimated_value flows into net worth', () => {
    const composition = {
      inside_financial: 100_000,
      inside_real_estate: 0,
      inside_business_gross: 750_000,
      inside_insurance: 0,
      gross_estate: 850_000,
      total_liabilities: 0,
      net_estate: 850_000,
    } as EstateComposition

    const summary = buildNetWorthSummaryFromDashboardInput({
      composition,
      financialAssetsFallback: 0,
      realEstateValueFallback: 0,
      businessValueFallback: 0,
      insuranceValueFallback: 0,
      mortgageBalance: 0,
      otherLiabilities: 0,
    })

    expect(summary.businessValue).toBe(750_000)
    expect(summary.netWorth).toBe(850_000)
  })

  test('fallback path: raw real_estate rows (value − mortgage) feed net worth without gated UI', () => {
    const summary = buildNetWorthSummaryFromDashboardInput({
      composition: null,
      financialAssetsFallback: 100_000,
      realEstateValueFallback: 800_000,
      businessValueFallback: 250_000,
      insuranceValueFallback: 0,
      mortgageBalance: 0,
      otherLiabilities: 50_000,
    })

    expect(summary.netWorth).toBe(1_100_000)
  })
})

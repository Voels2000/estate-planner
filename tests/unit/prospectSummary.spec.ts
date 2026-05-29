/**
 * Prospect summary unit tests
 * Run: npm run test:unit:prospect
 */
import { test, expect } from '@playwright/test'
import { buildProspectSummary } from '../../lib/prospect/calculateProspectSummary'
import type { ProspectTaxConfig } from '../../lib/prospect/getProspectTaxConfig'
import { OBBBA_2026 } from '../../lib/tax/estate-tax-constants'

const TAX_CONFIG: ProspectTaxConfig = {
  currentLaw: {
    exemptionIndividual: OBBBA_2026.BASIC_EXCLUSION_SINGLE,
    exemptionMarried: OBBBA_2026.BASIC_EXCLUSION_MFJ,
    topRatePct: OBBBA_2026.TOP_RATE * 100,
  },
  sunset: {
    exemptionIndividual: 7_000_000,
    exemptionMarried: 14_000_000,
    topRatePct: 40,
  },
  annualGiftExclusion: OBBBA_2026.ANNUAL_GIFT_EXCLUSION,
}

test.describe('buildProspectSummary', () => {
  test('CA married $5M–$15M has sunset delta and no state tax', () => {
    const summary = buildProspectSummary(
      {
        state: 'CA',
        range: 'lg',
        marital: 'married',
        businessOwner: false,
        age: 58,
      },
      TAX_CONFIG,
      [],
    )

    expect(summary.sunsetDelta).toBeGreaterThan(0)
    expect(summary.stateTax).toBe(0)
    expect(summary.selectedState).toBe('CA')
  })

  test('business owner adds succession planning gap', () => {
    const summary = buildProspectSummary(
      {
        state: 'CA',
        range: 'md',
        marital: 'married',
        businessOwner: true,
        age: 58,
      },
      TAX_CONFIG,
      [],
    )

    expect(summary.planningGaps.some((g) => /succession|business/i.test(g))).toBe(true)
  })

  test('WA with brackets can produce state tax', () => {
    const summary = buildProspectSummary(
      {
        state: 'WA',
        range: 'md',
        marital: 'married',
        businessOwner: false,
        age: 58,
      },
      TAX_CONFIG,
      [{ min_amount: 0, max_amount: 9_999_999_999, rate_pct: 10, exemption_amount: 2_000_000 }],
    )

    expect(summary.stateTax).toBeGreaterThan(0)
  })
})

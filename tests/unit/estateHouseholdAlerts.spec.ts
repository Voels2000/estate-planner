/**
 * Consumer household estate alerts — firing conditions.
 * Run: npx playwright test tests/unit/estateHouseholdAlerts.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  buildEstateHouseholdAlertRules,
  deriveBusinessInterestValue,
  derivePreTaxRetirementBalance,
  hasActiveGratStrategy,
  GRAT_BUSINESS_THRESHOLD,
  ROTH_PRE_TAX_THRESHOLD,
  ILIT_GAP_DOLLARS,
  LARGE_ESTATE_THRESHOLD_SINGLE,
} from '../../lib/alerts/estateHouseholdAlerts'

const emptyCtx = {
  household: { filing_status: 'single' },
  assets: [] as Record<string, unknown>[],
  insurancePolicies: [] as { death_benefit?: number | null; is_ilit?: boolean | null }[],
  realEstateRows: [] as { current_value?: number | null }[],
  estateHealthCheck: null,
}

function ruleFire(id: string, ctx: Parameters<typeof buildEstateHouseholdAlertRules>[0]) {
  return buildEstateHouseholdAlertRules(ctx).find((r) => r.id === id)?.fire
}

test.describe('estate household alert inputs', () => {
  test('derivePreTaxRetirementBalance sums traditional accounts only', () => {
    const total = derivePreTaxRetirementBalance([
      { type: 'traditional_ira', value: 400_000 },
      { type: 'roth_ira', value: 200_000 },
      { type: 'traditional_401k', value: 150_000 },
    ])
    expect(total).toBe(550_000)
  })

  test('hasActiveGratStrategy detects active grat line items', () => {
    expect(hasActiveGratStrategy([{ strategy_source: 'grat', is_active: true }])).toBe(true)
    expect(hasActiveGratStrategy([{ strategy_source: 'grat', is_active: false }])).toBe(false)
    expect(hasActiveGratStrategy([{ strategy_source: 'roth', is_active: true }])).toBe(false)
  })

  test('deriveBusinessInterestValue includes asset and business tables', () => {
    const total = deriveBusinessInterestValue(
      [{ type: 'business_interest', value: 300_000 }],
      [{ estimated_value: 400_000, ownership_pct: 50 }],
      [],
    )
    expect(total).toBe(500_000)
  })
})

test.describe('estate_grat_opportunity', () => {
  test('fires when business interest exceeds threshold, no GRAT, large estate', () => {
    expect(
      ruleFire('estate_grat_opportunity', {
        ...emptyCtx,
        household: { filing_status: 'single' },
        assets: [
          { type: 'business_interest', value: GRAT_BUSINESS_THRESHOLD + 1 },
          { type: 'taxable_brokerage', value: LARGE_ESTATE_THRESHOLD_SINGLE },
        ],
        strategyLineItems: [],
      }),
    ).toBe(true)
  })

  test('silent when GRAT on file', () => {
    expect(
      ruleFire('estate_grat_opportunity', {
        ...emptyCtx,
        assets: [
          { type: 'business_interest', value: 1_000_000 },
          { type: 'taxable_brokerage', value: LARGE_ESTATE_THRESHOLD_SINGLE },
        ],
        strategyLineItems: [{ strategy_source: 'grat', is_active: true }],
      }),
    ).toBe(false)
  })
})

test.describe('estate_roth_window', () => {
  test('fires when pre-tax balance exceeds threshold', () => {
    expect(
      ruleFire('estate_roth_window', {
        ...emptyCtx,
        assets: [{ type: 'traditional_ira', value: ROTH_PRE_TAX_THRESHOLD + 1 }],
      }),
    ).toBe(true)
  })

  test('silent below threshold', () => {
    expect(
      ruleFire('estate_roth_window', {
        ...emptyCtx,
        assets: [{ type: 'traditional_ira', value: ROTH_PRE_TAX_THRESHOLD }],
      }),
    ).toBe(false)
  })
})

test.describe('estate_ilit_gap', () => {
  test('fires above ILIT gap dollars', () => {
    expect(
      ruleFire('estate_ilit_gap', {
        ...emptyCtx,
        insurancePolicies: [{ death_benefit: ILIT_GAP_DOLLARS + 1, is_ilit: false }],
      }),
    ).toBe(true)
  })

  test('silent at or below gap', () => {
    expect(
      ruleFire('estate_ilit_gap', {
        ...emptyCtx,
        insurancePolicies: [{ death_benefit: ILIT_GAP_DOLLARS, is_ilit: false }],
      }),
    ).toBe(false)
  })
})

test.describe('estate_gifting_gap', () => {
  test('fires for large estate without gifting program', () => {
    expect(
      ruleFire('estate_gifting_gap', {
        ...emptyCtx,
        household: { filing_status: 'single', has_gifting_program: false },
        assets: [{ type: 'taxable_brokerage', value: LARGE_ESTATE_THRESHOLD_SINGLE + 1 }],
      }),
    ).toBe(true)
  })
})

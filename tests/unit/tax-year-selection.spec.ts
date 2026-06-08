/**
 * Verifies projection engines do not require historical DB tax years (2023–2025).
 * Run: npx playwright test tests/unit/tax-year-selection.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { getBracketsForState, calculateStateIncomeTax } from '../../lib/calculations/stateIncomeTax'
import { getFederalExemption } from '../../lib/calculations/estate-tax'
import { latestFederalBracketsFromRows } from '../../lib/tax/federalExportTax'
import { MODELED_INHERITANCE_TAX_STATES } from '../../lib/calculations/stateEstateTax'
import { calculateInheritanceTax } from '../../lib/projection/stateRegistry'

const WA_MFJ_2026 = [
  { state: 'WA', tax_year: 2026, filing_status: 'mfj' as const, min_amount: 0, max_amount: null, rate_pct: 10 },
  { state: 'WA', tax_year: 2026, filing_status: 'mfj' as const, min_amount: 1000000, max_amount: null, rate_pct: 20 },
]

const FEDERAL_ESTATE_2026 = [
  { tax_year: 2026, min_amount: 0, max_amount: 10000, rate_pct: 18 },
  { tax_year: 2026, min_amount: 10000, max_amount: 20000, rate_pct: 20 },
  { tax_year: 2026, min_amount: 20000, max_amount: 999999999999999, rate_pct: 22 },
]

test.describe('tax year selection without 2023–2025 DB rows', () => {
  test('state income brackets: 2026-only data serves 2026–2030 projection years', () => {
    for (const projectionYear of [2026, 2027, 2028, 2030]) {
      const brackets = getBracketsForState(WA_MFJ_2026, 'WA', 'mfj', projectionYear)
      expect(brackets.length).toBeGreaterThan(0)
      expect(brackets.every((b) => b.tax_year === 2026)).toBe(true)
    }
  })

  test('state income tax uses 2026 brackets for future projection years', () => {
    const { stateTax: tax2027 } = calculateStateIncomeTax({
      ordinaryIncome: 500_000,
      stateCode: 'WA',
      filingStatus: 'mfj',
      brackets: WA_MFJ_2026,
      taxYear: 2027,
    })
    const { stateTax: tax2026 } = calculateStateIncomeTax({
      ordinaryIncome: 500_000,
      stateCode: 'WA',
      filingStatus: 'mfj',
      brackets: WA_MFJ_2026,
      taxYear: 2026,
    })
    expect(tax2027).toBe(tax2026)
  })

  test('federal exemption uses code constants for 2026+ (no 2025 table rows required)', () => {
    expect(getFederalExemption(2026)).toBe(15_000_000)
    expect(getFederalExemption(2027)).toBe(15_000_000)
    expect(getFederalExemption(2030)).toBe(15_000_000)
  })

  test('federal estate brackets: latest year selection works with 2026-only rows', () => {
    const brackets = latestFederalBracketsFromRows(FEDERAL_ESTATE_2026)
    expect(brackets.length).toBe(3)
    expect(brackets[0].min_amount).toBe(0)
  })

  test('inheritance scan modeled states calculate cleanly for 2026 without DB rows', () => {
    for (const state of MODELED_INHERITANCE_TAX_STATES) {
      const result = calculateInheritanceTax({
        state,
        beneficiaryType: 'other',
        inheritanceAmount: 100_000,
        year: 2026,
      })
      expect(result.taxDue).toBeGreaterThanOrEqual(0)
    }
    // Iowa repealed — must be zero for 2026
    expect(
      calculateInheritanceTax({
        state: 'IA',
        beneficiaryType: 'other',
        inheritanceAmount: 100_000,
        year: 2026,
      }).taxDue,
    ).toBe(0)
  })
})

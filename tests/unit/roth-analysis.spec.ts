/**
 * Roth conversion analysis unit tests
 * Run: npx playwright test tests/unit/roth-analysis.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  pickRothConversionDisplayContext,
  runRothAnalysis,
  type RothYearResult,
} from '../../lib/calculations/roth-analysis'
import type { YearRow } from '../../lib/calculations/projection-complete'

const MFJ_2024 = [
  { filing_status: 'mfj', min_amount: 0, max_amount: 23200, rate_pct: 10, tax_year: 2024, bracket_order: 1 },
  { filing_status: 'mfj', min_amount: 23200, max_amount: 94300, rate_pct: 12, tax_year: 2024, bracket_order: 2 },
  { filing_status: 'mfj', min_amount: 94300, max_amount: 201050, rate_pct: 22, tax_year: 2024, bracket_order: 3 },
  { filing_status: 'mfj', min_amount: 201050, max_amount: 383900, rate_pct: 24, tax_year: 2024, bracket_order: 4 },
]

function makeRow(year: number, age1: number, age2: number, income: number, rmd: number): YearRow {
  const total = income + rmd
  return {
    year,
    age_person1: age1,
    age_person2: age2,
    income_earned: 0,
    income_ss_person1: income / 2,
    income_ss_person2: income / 2,
    income_rmd: rmd,
    income_other: 0,
    income_total: total,
    income_earned_p1: 0,
    income_earned_p2: 0,
    income_rmd_p1: rmd,
    income_rmd_p2: 0,
    income_other_p1: 0,
    income_other_p2: 0,
    income_other_pooled: 0,
    tax_federal: 0,
    tax_state: 0,
    tax_state_secondary: 0,
    tax_capital_gains: 0,
    tax_niit: 0,
    tax_payroll: 0,
    irmaa_part_b: 0,
    irmaa_part_d: 0,
    tax_total: 0,
    expenses_living: 0,
    expenses_healthcare: 0,
    expenses_total: 0,
    assets_tax_deferred: 0,
    assets_roth: 0,
    assets_taxable: 0,
    assets_total: 0,
    assets_pooled_total: 0,
    assets_p1_tax_deferred: 0,
    assets_p1_roth: 0,
    assets_p1_taxable: 0,
    assets_p1_total: 0,
    assets_p2_tax_deferred: 0,
    assets_p2_roth: 0,
    assets_p2_taxable: 0,
    assets_p2_total: 0,
    real_estate_primary: 0,
    real_estate_other: 0,
    real_estate_total: 0,
    liabilities_mortgage: 0,
    liabilities_other: 0,
    liabilities_total: 0,
    estate_excl_home: 0,
    estate_incl_home: 0,
    net_cash_flow: 0,
    net_worth: 0,
  }
}

test.describe('runRothAnalysis', () => {
  test('recommends gap-year conversions up to the 22% bracket before 24% RMD marginal', () => {
    const rows = [
      makeRow(2026, 60, 58, 250_000, 0),
      ...Array.from({ length: 5 }, (_, i) => makeRow(2028 + i, 62 + i, 60 + i, 60_000, 0)),
      ...Array.from({ length: 3 }, (_, i) => makeRow(2033 + i, 67 + i, 65 + i, 60_000, 250_000)),
    ]

    const result = runRothAnalysis({
      rows,
      filingStatus: 'mfj',
      stateCode: null,
      stateIncomeTaxBrackets: [],
      federalIncomeTaxBrackets: MFJ_2024,
      taxDeferredBalance: 2_000_000,
      rothBalance: 0,
      taxableBalance: 200_000,
      growthRateRetirement: 0.05,
      maxAnnualConversion: 500_000,
      standardDeduction: 29_200,
      inflationRate: 0.025,
      person1BirthYear: 1966,
      person2BirthYear: 1968,
      rmdStartAge: 73,
    })

    expect(result.optimalConversionWindow).toEqual({ startYear: 2028, endYear: 2032 })
    expect(result.totalConversions).toBeGreaterThan(0)

    const gapRow = result.rows.find((r) => r.year === 2028)
    expect(gapRow?.recommendedConversion).toBeGreaterThan(50_000)
    expect(gapRow?.recommendedConversion).toBeLessThanOrEqual(201_050 - 30_800)

    const rmdRow = result.rows.find((r) => r.year === 2033)
    expect(Math.round((rmdRow?.combinedMarginalRate ?? 0) * 100)).toBe(24)
    expect(rmdRow?.recommendedConversion).toBe(0)
  })

  test('fills through the 22% bracket when RMD-era federal marginal is 22%', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => makeRow(2028 + i, 62 + i, 60 + i, 80_000, 0)),
      makeRow(2033, 67, 65, 80_000, 120_000),
    ]

    const result = runRothAnalysis({
      rows,
      filingStatus: 'mfj',
      stateCode: null,
      stateIncomeTaxBrackets: [],
      federalIncomeTaxBrackets: MFJ_2024,
      taxDeferredBalance: 1_500_000,
      rothBalance: 0,
      taxableBalance: 200_000,
      growthRateRetirement: 0.05,
      maxAnnualConversion: 500_000,
      standardDeduction: 29_200,
      inflationRate: 0.025,
      person1BirthYear: 1966,
      person2BirthYear: 1968,
      rmdStartAge: 73,
    })

    const gapRow = result.rows.find((r) => r.year === 2028)
    expect(gapRow?.recommendedConversion).toBeGreaterThan(90_000)
  })
})

test.describe('pickRothConversionDisplayContext', () => {
  test('uses the conversion window rate, not projection row 0', () => {
    const rows: RothYearResult[] = [
      {
        year: 2026,
        age1: 60,
        age2: 58,
        totalIncome: 300_000,
        ssIncome: 0,
        rmdAmount: 0,
        earnedIncome: 300_000,
        otherIncome: 0,
        federalTax: 0,
        stateTax: 0,
        totalTax: 0,
        federalMarginalRate: 0.32,
        stateMarginalRate: 0,
        combinedMarginalRate: 0.32,
        recommendedConversion: 0,
        conversionRationale: '',
        incrementalFederalTax: 0,
        incrementalStateTax: 0,
        incrementalTotalTax: 0,
        taxDeferredEnd: 0,
        rothEnd: 0,
        taxableEnd: 0,
        cumulativeConversions: 0,
        cumulativeLifetimeTaxSavings: 0,
      },
      {
        year: 2028,
        age1: 62,
        age2: 60,
        totalIncome: 60_000,
        ssIncome: 60_000,
        rmdAmount: 0,
        earnedIncome: 0,
        otherIncome: 0,
        federalTax: 0,
        stateTax: 0,
        totalTax: 0,
        federalMarginalRate: 0.12,
        stateMarginalRate: 0,
        combinedMarginalRate: 0.12,
        recommendedConversion: 60_000,
        conversionRationale: 'window',
        incrementalFederalTax: 0,
        incrementalStateTax: 0,
        incrementalTotalTax: 0,
        taxDeferredEnd: 0,
        rothEnd: 0,
        taxableEnd: 0,
        cumulativeConversions: 0,
        cumulativeLifetimeTaxSavings: 0,
      },
      {
        year: 2033,
        age1: 67,
        age2: 65,
        totalIncome: 310_000,
        ssIncome: 60_000,
        rmdAmount: 250_000,
        earnedIncome: 0,
        otherIncome: 0,
        federalTax: 0,
        stateTax: 0,
        totalTax: 0,
        federalMarginalRate: 0.24,
        stateMarginalRate: 0,
        combinedMarginalRate: 0.24,
        recommendedConversion: 0,
        conversionRationale: '',
        incrementalFederalTax: 0,
        incrementalStateTax: 0,
        incrementalTotalTax: 0,
        taxDeferredEnd: 0,
        rothEnd: 0,
        taxableEnd: 0,
        cumulativeConversions: 0,
        cumulativeLifetimeTaxSavings: 0,
      },
    ]

    const ctx = pickRothConversionDisplayContext(rows)
    expect(ctx.currentRatePct).toBe(12)
    expect(ctx.projectedRmdRatePct).toBe(24)
  })
})

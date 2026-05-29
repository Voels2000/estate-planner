/**
 * Projection readiness unit tests — /projections empty state fix
 * Run: npx playwright test tests/unit/projectionReadiness.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { checkProjectionReadiness } from '../../lib/planning/projectionReadiness'

test.describe('checkProjectionReadiness', () => {
  test('no data at all → ready:false, canShowPartial:false', () => {
    const result = checkProjectionReadiness({
      person1BirthYear: null,
      person1RetirementAge: null,
      totalIncome: 0,
      totalAssets: 0,
    })
    expect(result.ready).toBe(false)
    expect(result.canShowPartial).toBe(false)
    expect(result.missingFields).toEqual(['birth_year', 'retirement_age', 'income_or_assets'])
  })

  test('assets only, no age → ready:false, canShowPartial:true', () => {
    const result = checkProjectionReadiness({
      person1BirthYear: null,
      person1RetirementAge: null,
      totalIncome: 0,
      totalAssets: 500_000,
    })
    expect(result.ready).toBe(false)
    expect(result.canShowPartial).toBe(true)
    expect(result.missingFields).toContain('birth_year')
    expect(result.missingFields).toContain('retirement_age')
    expect(result.missingFields).not.toContain('income_or_assets')
  })

  test('income only, no age → ready:false, canShowPartial:true', () => {
    const result = checkProjectionReadiness({
      person1BirthYear: null,
      person1RetirementAge: 65,
      totalIncome: 120_000,
      totalAssets: 0,
    })
    expect(result.ready).toBe(false)
    expect(result.canShowPartial).toBe(true)
    expect(result.missingFields).toEqual(['birth_year'])
  })

  test('age fields only, no financial data → ready:false, canShowPartial:false', () => {
    const result = checkProjectionReadiness({
      person1BirthYear: 1965,
      person1RetirementAge: 65,
      totalIncome: 0,
      totalAssets: 0,
    })
    expect(result.ready).toBe(false)
    expect(result.canShowPartial).toBe(false)
    expect(result.missingFields).toEqual(['income_or_assets'])
  })

  test('all fields present → ready:true', () => {
    const result = checkProjectionReadiness({
      person1BirthYear: 1965,
      person1RetirementAge: 65,
      totalIncome: 120_000,
      totalAssets: 500_000,
    })
    expect(result.ready).toBe(true)
    expect(result.canShowPartial).toBe(false)
    expect(result.missingFields).toEqual([])
  })
})

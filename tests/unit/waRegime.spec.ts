/**
 * Washington Regime D golden vectors (ESB 6347, eff. 2026-07-01).
 * Run: npx playwright test tests/unit/waRegime.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  WA_REGIME_D,
  calcWaEstateTax,
  calcWaTaxOnTaxableEstate,
  resolveWaRegime,
  waRegimeToStateBrackets,
} from '../../lib/estate/waRegime'
import {
  calculateStateEstateTax,
  resolveActiveStateTax,
} from '../../lib/calculations/stateEstateTax'
import { mapAndResolveStateEstateBrackets } from '../../lib/estate/resolveStateEstateBrackets'

test.describe('WA Regime D', () => {
  test('resolveWaRegime returns D for planning dates', () => {
    expect(resolveWaRegime(new Date('2026-07-01')).id).toBe('D')
    expect(resolveWaRegime(new Date('2025-01-01')).id).toBe('D')
  })

  test('taxable estate golden vectors', () => {
    expect(calcWaTaxOnTaxableEstate(1_000_000)).toBe(100_000)
    expect(calcWaTaxOnTaxableEstate(2_000_000)).toBe(240_000)
    expect(calcWaTaxOnTaxableEstate(0)).toBe(0)
  })

  test('gross estate after $3M exemption', () => {
    expect(calcWaEstateTax(4_000_000)).toBe(100_000)
    expect(calcWaEstateTax(3_000_000)).toBe(0)
  })

  test('Voels-scale gross estate (~$9.8M) single exemption', () => {
    const gross = 9_806_626
    const brackets = waRegimeToStateBrackets(WA_REGIME_D)
    const result = calculateStateEstateTax(gross, 'WA', brackets, true, false)
    const stateTax = resolveActiveStateTax(result, false)
    expect(stateTax).toBe(1_063_259)
    expect(calcWaEstateTax(gross)).toBe(1_063_259)
  })

  test('mapAndResolveStateEstateBrackets overrides WA DB drift', () => {
    const staleDb = [
      {
        min_amount: 0,
        max_amount: 9_999_999_999,
        rate_pct: 35,
        exemption_amount: 2_193_000,
      },
    ]
    const resolved = mapAndResolveStateEstateBrackets({
      stateCode: 'WA',
      rows: staleDb,
    })
    expect(resolved[0].exemption_amount).toBe(3_000_000)
    expect(resolved[0].rate_pct).toBe(10)
    expect(resolved.length).toBe(WA_REGIME_D.brackets.length)
  })

  test('non-WA states pass through DB brackets', () => {
    const orRows = [{ min_amount: 0, max_amount: 9_999_999_999, rate_pct: 16, exemption_amount: 1_000_000 }]
    const resolved = mapAndResolveStateEstateBrackets({ stateCode: 'OR', rows: orRows })
    expect(resolved).toEqual(orRows)
  })
})

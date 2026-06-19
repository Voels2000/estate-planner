/**
 * Monte Carlo assumption row mapping — live helper parity with former mergeAssumptions.
 * Run: npx playwright test tests/unit/monteCarloAssumptionsFromRow.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { monteCarloAssumptionsFromRow } from '../../lib/advisor/monteCarloFromRow'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '../../lib/calculations/monteCarlo'

test.describe('monteCarloAssumptionsFromRow', () => {
  test('null row returns system defaults for every field', () => {
    expect(monteCarloAssumptionsFromRow(null)).toEqual(MONTE_CARLO_SYSTEM_DEFAULTS)
  })

  test('partial overrides win; missing fields fall back to defaults', () => {
    const result = monteCarloAssumptionsFromRow({
      return_mean_pct: 8,
      volatility_pct: 15,
    })
    expect(result.returnMeanPct).toBe(8)
    expect(result.volatilityPct).toBe(15)
    expect(result.withdrawalRatePct).toBe(MONTE_CARLO_SYSTEM_DEFAULTS.withdrawalRatePct)
    expect(result.successThreshold).toBe(MONTE_CARLO_SYSTEM_DEFAULTS.successThreshold)
    expect(result.simulationCount).toBe(MONTE_CARLO_SYSTEM_DEFAULTS.simulationCount)
    expect(result.planningHorizonYr).toBe(MONTE_CARLO_SYSTEM_DEFAULTS.planningHorizonYr)
    expect(result.inflationRatePct).toBe(MONTE_CARLO_SYSTEM_DEFAULTS.inflationRatePct)
  })

  test('row with all-null fields returns defaults', () => {
    const result = monteCarloAssumptionsFromRow({
      return_mean_pct: null,
      volatility_pct: null,
      withdrawal_rate_pct: null,
      success_threshold: null,
      simulation_count: null,
      planning_horizon_yr: null,
      inflation_rate_pct: null,
    })
    expect(result).toEqual(MONTE_CARLO_SYSTEM_DEFAULTS)
  })

  test('coerces string-numeric DB values to numbers', () => {
    const result = monteCarloAssumptionsFromRow({
      return_mean_pct: '7.5' as unknown as number,
      volatility_pct: '11' as unknown as number,
    })
    expect(result.returnMeanPct).toBe(7.5)
    expect(typeof result.returnMeanPct).toBe('number')
    expect(result.volatilityPct).toBe(11)
    expect(typeof result.volatilityPct).toBe('number')
  })
})

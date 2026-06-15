/**
 * Washington Regime D golden vectors (ESB 6347, eff. 2026-07-01).
 * Run: npx playwright test tests/unit/waRegime.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  WA_REGIME_D,
  calcWaBypassPlanningBenefit,
  calcWaEstateTax,
  calcWaEstateTaxWithBypass,
  calcWaTaxOnTaxableEstate,
  resolveWaRegime,
  waBypassFundingAmount,
  waRegimeToStateBrackets,
} from '../../lib/estate/waRegime'
import {
  calculateStateEstateTax,
  computeBypassFundingAmount,
  resolveActiveStateTax,
  resolveStateTaxForDeathPhase,
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

test.describe('WA bypass trust modeling (Regime D, second death)', () => {
  const brackets = waRegimeToStateBrackets(WA_REGIME_D)
  const voelsGross = 9_806_626

  test('without bypass uses single $3M exemption — not doubled / ported', () => {
    const result = calculateStateEstateTax(voelsGross, 'WA', brackets, true)
    expect(result.exemptionUsed).toBe(3_000_000)
    expect(result.taxableEstate).toBe(6_806_626)
    expect(result.stateTax).toBe(1_063_259)
    expect(result.hasPortabilityGap).toBe(true)
  })

  test('Voels with bypass — taxable $3,806,627 → $519,060', () => {
    const result = calculateStateEstateTax(voelsGross, 'WA', brackets, true)
    expect(result.bypassFundingAmount).toBe(3_000_000)
    expect(result.taxableEstateWithCST).toBe(3_806_626)
    expect(result.stateTaxWithCST).toBe(519_060)
    expect(calcWaEstateTaxWithBypass(voelsGross)).toBe(519_060)
    expect(resolveActiveStateTax(result, true)).toBe(519_060)
  })

  test('Voels planning benefit — $544,199', () => {
    const result = calculateStateEstateTax(voelsGross, 'WA', brackets, true)
    expect(result.cstBenefit).toBe(544_199)
    expect(calcWaBypassPlanningBenefit(voelsGross)).toBe(544_199)
  })

  test('$5M community-property couple — funding cap and without-bypass tax', () => {
    const gross = 5_000_000
    expect(waBypassFundingAmount(gross)).toBe(2_500_000)
    expect(computeBypassFundingAmount(gross, 3_000_000)).toBe(2_500_000)

    const result = calculateStateEstateTax(gross, 'WA', brackets, true)
    expect(result.taxableEstate).toBe(2_000_000)
    expect(result.stateTax).toBe(240_000)
    expect(result.stateTaxWithCST).toBe(0)
    expect(result.cstBenefit).toBe(240_000)
    expect(calcWaEstateTax(gross)).toBe(240_000)
    expect(calcWaEstateTaxWithBypass(gross)).toBe(0)
  })

  test('funding cap when first-spouse share is below exemption — flat G−$6M overstates benefit', () => {
    const gross = 5_500_000
    const firstSpouseShare = 2_000_000
    const result = calculateStateEstateTax(gross, 'WA', brackets, true, false, {
      firstSpouseShare,
    })
    expect(result.bypassFundingAmount).toBe(2_000_000)
    expect(result.taxableEstateWithCST).toBe(500_000)
    expect(result.stateTaxWithCST).toBe(50_000)
    expect(result.stateTax).toBe(315_000)
    expect(result.cstBenefit).toBe(265_000)

    // Legacy flat (G − 2×exemption) would wrongly show $0 with-bypass tax here.
    const legacyWithTaxable = Math.max(0, gross - 6_000_000)
    expect(legacyWithTaxable).toBe(0)
    expect(result.taxableEstateWithCST).toBeGreaterThan(legacyWithTaxable)
  })

  test('first death MFJ path returns $0 — raw engine would mis-price if miswired', () => {
    const gross = voelsGross
    const rawSecondDeath = calculateStateEstateTax(gross, 'WA', brackets, true)
    expect(rawSecondDeath.stateTax).toBe(1_063_259)

    const firstDeath = resolveStateTaxForDeathPhase({
      grossEstate: gross,
      stateCode: 'WA',
      brackets,
      isMFJ: true,
      hasSpouse: true,
      deathPhase: 'first_death',
    })
    expect(firstDeath.isFirstDeath).toBe(true)
    expect(firstDeath.activeStateTax).toBe(0)
    expect(firstDeath.stateTax).toBe(0)
    expect(firstDeath.stateTaxWithCST).toBe(0)
    expect(firstDeath.cstBenefit).toBe(0)

    const secondDeath = resolveStateTaxForDeathPhase({
      grossEstate: gross,
      stateCode: 'WA',
      brackets,
      isMFJ: true,
      hasSpouse: true,
      deathPhase: 'second_death',
    })
    expect(secondDeath.isFirstDeath).toBe(false)
    expect(secondDeath.activeStateTax).toBe(1_063_259)
    expect(secondDeath.stateTaxWithCST).toBe(519_060)
    expect(secondDeath.cstBenefit).toBe(544_199)
  })
})

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
  calculateStateEstateTaxProjectionAware,
  computeBypassFundingAmount,
  resolveActiveStateTax,
  resolveStateTaxForDeathPhase,
  resolveSurvivorGrossAtSecondDeath,
} from '../../lib/calculations/stateEstateTax'
import { mapAndResolveStateEstateBrackets } from '../../lib/estate/resolveStateEstateBrackets'
import {
  WA_DOR_GROSS_GOLDENS,
  WA_DOR_HIGH_GROSS_GOLDEN,
  WA_DOR_TABLE_W_TAXABLE_GOLDENS,
} from '../../lib/estate/waRegimeDorGoldens'

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

test.describe('WA DOR Table W (eff. 2026-07-01)', () => {
  const brackets = waRegimeToStateBrackets(WA_REGIME_D)

  test('Regime D $7M–$9M band rate is 19.5% (not 19%)', () => {
    const band = WA_REGIME_D.brackets.find((b) => b.upTo === 9_000_000)
    expect(band?.rate).toBe(0.195)
    const engineBand = brackets.find((b) => b.min_amount === 7_000_000)
    expect(engineBand?.rate_pct).toBe(19.5)
    expect(engineBand?.max_amount).toBe(9_000_000)
  })

  test('$9M taxable cumulative base is $1,490,000 ($910K + $2M × 19.5%)', () => {
    expect(calcWaTaxOnTaxableEstate(9_000_000)).toBe(1_490_000)
  })

  for (const row of WA_DOR_TABLE_W_TAXABLE_GOLDENS) {
    test(`taxable $${row.taxableEstate.toLocaleString()} → $${row.expectedTax.toLocaleString()} (${row.band})`, () => {
      expect(calcWaTaxOnTaxableEstate(row.taxableEstate)).toBe(row.expectedTax)
      const engine = calculateStateEstateTax(
        row.taxableEstate + WA_REGIME_D.exemption,
        'WA',
        brackets,
        false,
      )
      expect(engine.stateTax).toBe(row.expectedTax)
    })
  }

  for (const row of WA_DOR_GROSS_GOLDENS) {
    test(`gross $${row.grossEstate.toLocaleString()} → $${row.expectedTax.toLocaleString()} (taxable $${row.taxableEstate.toLocaleString()})`, () => {
      expect(calcWaEstateTax(row.grossEstate)).toBe(row.expectedTax)
      const engine = calculateStateEstateTax(row.grossEstate, 'WA', brackets, false)
      expect(engine.taxableEstate).toBe(row.taxableEstate)
      expect(engine.stateTax).toBe(row.expectedTax)
    })
  }

  test('$12M gross exercises $7M–$9M and $9M+ bands (without bypass)', () => {
    const { grossEstate, stateTaxWithoutBypass, taxableEstate } = WA_DOR_HIGH_GROSS_GOLDEN
    expect(calcWaEstateTax(grossEstate)).toBe(stateTaxWithoutBypass)
    const result = calculateStateEstateTax(grossEstate, 'WA', brackets, true)
    expect(result.taxableEstate).toBe(taxableEstate)
    expect(result.stateTax).toBe(stateTaxWithoutBypass)
  })

  test('$12M gross with full bypass funding — survivor $9M, taxable $6M', () => {
    const gross = WA_DOR_HIGH_GROSS_GOLDEN.grossEstate
    const result = calculateStateEstateTax(gross, 'WA', brackets, true)
    expect(result.bypassFundingAmount).toBe(3_000_000)
    expect(result.taxableEstateWithCST).toBe(6_000_000)
    expect(result.stateTaxWithCST).toBe(910_000)
    expect(result.cstBenefit).toBe(580_000)
  })
})

test.describe('WA projection-aware CST (growth between deaths)', () => {
  const brackets = waRegimeToStateBrackets(WA_REGIME_D)
  const voelsGrossAtSecondDeath = 9_806_626
  const grossAtFirstDeath = 8_000_000
  const growthRate = 0.07

  test('survivor gross compounds CST at asset growth rate when years are known', () => {
    const { survivorGross, bypassFundingAtFirstDeath, cstValueAtSecondDeath } =
      resolveSurvivorGrossAtSecondDeath({
        grossAtFirstDeath,
        grossAtSecondDeath: voelsGrossAtSecondDeath,
        exemption: 3_000_000,
        yearsBetweenDeaths: 10,
        assetGrowthRate: growthRate,
      })
    expect(bypassFundingAtFirstDeath).toBe(3_000_000)
    expect(cstValueAtSecondDeath).toBeCloseTo(5_901_454, 0)
    expect(survivorGross).toBeCloseTo(3_905_172, 0)
  })

  test('Voels-scale projection (10yr @ 7%) — with-CST tax below snapshot, benefit above $544,199', () => {
    const snapshot = calculateStateEstateTax(voelsGrossAtSecondDeath, 'WA', brackets, true)
    const projection = calculateStateEstateTaxProjectionAware(
      voelsGrossAtSecondDeath,
      'WA',
      brackets,
      true,
      { grossAtFirstDeath, yearsBetweenDeaths: 10, assetGrowthRate: growthRate },
    )

    expect(snapshot.stateTax).toBe(1_063_259)
    expect(snapshot.stateTaxWithCST).toBe(519_060)
    expect(snapshot.cstBenefit).toBe(544_199)

    expect(projection.stateTax).toBe(1_063_259)
    expect(projection.stateTaxWithCST).toBeLessThan(snapshot.stateTaxWithCST)
    expect(projection.cstBenefit).toBeGreaterThan(snapshot.cstBenefit)
    expect(projection.stateTaxWithCST).toBe(90_517)
    expect(projection.cstBenefit).toBe(972_742)
    expect(resolveActiveStateTax(projection, true)).toBe(90_517)
  })

  test('drawdown (G2 < G1) — CST does not shrink; survivor absorbs spend-down', () => {
    const grossAtSecondDeath = 7_000_000
    const firstDeath = 9_806_626
    const { cstValueAtSecondDeath, bypassFundingAtFirstDeath } = resolveSurvivorGrossAtSecondDeath({
      grossAtFirstDeath: firstDeath,
      grossAtSecondDeath,
      exemption: 3_000_000,
      yearsBetweenDeaths: 15,
      assetGrowthRate: growthRate,
    })
    expect(bypassFundingAtFirstDeath).toBe(3_000_000)
    expect(cstValueAtSecondDeath).toBeGreaterThanOrEqual(bypassFundingAtFirstDeath)
    expect(cstValueAtSecondDeath).toBe(7_000_000)

    const projection = calculateStateEstateTaxProjectionAware(
      grossAtSecondDeath,
      'WA',
      brackets,
      true,
      { grossAtFirstDeath: firstDeath, yearsBetweenDeaths: 15, assetGrowthRate: growthRate },
    )
    expect(projection.stateTax).toBe(550_000)
    expect(projection.stateTaxWithCST).toBe(0)
    expect(projection.cstBenefit).toBe(550_000)
  })

  test('funding cap at G1 then grow — capped $2M funds to $4.52M CST, survivor below exemption', () => {
    const grossAtFirstDeathCapped = 5_500_000
    const grossAtSecondDeathCapped = 7_000_000
    const firstSpouseShare = 2_000_000
    const snapshot = calculateStateEstateTax(grossAtSecondDeathCapped, 'WA', brackets, true, false, {
      firstSpouseShare,
    })
    const projection = calculateStateEstateTaxProjectionAware(
      grossAtSecondDeathCapped,
      'WA',
      brackets,
      true,
      {
        grossAtFirstDeath: grossAtFirstDeathCapped,
        yearsBetweenDeaths: 12,
        assetGrowthRate: growthRate,
      },
      { firstSpouseShare },
    )

    expect(snapshot.bypassFundingAmount).toBe(2_000_000)
    expect(snapshot.stateTaxWithCST).toBe(240_000)

    expect(projection.bypassFundingAmount).toBe(2_000_000)
    expect(projection.stateTax).toBe(550_000)
    expect(projection.stateTaxWithCST).toBe(0)
    expect(projection.cstBenefit).toBe(550_000)
    expect(projection.cstBenefit).toBeGreaterThan(snapshot.cstBenefit)
  })

  test('falls back to snapshot when first-death gross is missing', () => {
    const snapshot = calculateStateEstateTax(voelsGrossAtSecondDeath, 'WA', brackets, true)
    const fallback = calculateStateEstateTaxProjectionAware(
      voelsGrossAtSecondDeath,
      'WA',
      brackets,
      true,
      { grossAtFirstDeath: 0 },
    )
    expect(fallback).toEqual(snapshot)
  })
})

// Sprint 72 - Advisory Metrics Engine
// 8-metric panel for advisor client view
// All metrics derive from existing projection data - no new DB queries needed
//
// Metrics:
// 1. Effective Estate Tax Rate
// 2. Cost of Inaction (annual cost of not planning)
// 3. Exemption Utilization
// 4. DSUE at Risk (portability carryover at risk if survivor remarries)
// 5. Liquidity Coverage Ratio
// 6. Strategy NPV (best single strategy NPV)
// 7. GRAT Breakeven Rate (minimum growth to beat §7520)
// 8. CST Crossover Year

export interface AdvisoryMetricsInput {
  // Estate values
  grossEstate: number
  federalExemption: number
  federalTax: number
  stateTax: number
  // Portability
  hasSpouse: boolean
  dsueAvailable: number
  // Liquidity
  liquidAssets: number
  ilitDeathBenefit: number
  // Strategy NPV (from calculateStrategyNPV results if run)
  bestStrategyNPV?: number
  bestStrategyName?: string
  // GRAT inputs
  section7520Rate: number
  // CST inputs
  cstFundingAmount?: number
  cstGrowthRate?: number
  survivorExemption?: number
  // Monte Carlo P50 (if run)
  monteCarloP50Tax?: number
  // Stress scenario
  noExemptionStressTax?: number
}

export interface AdvisoryMetric {
  id: string
  label: string
  scope: 'federal' | 'state' | 'both' | 'strategy'
  value: string
  subtext: string
  status: 'good' | 'warning' | 'critical' | 'neutral'
  detail: string
}

export interface AdvisoryMetricsResult {
  metrics: AdvisoryMetric[]
}

export function calculateAdvisoryMetrics(input: AdvisoryMetricsInput): AdvisoryMetricsResult {
  const {
    grossEstate,
    federalExemption,
    federalTax,
    stateTax,
    hasSpouse,
    dsueAvailable,
    liquidAssets,
    ilitDeathBenefit,
    bestStrategyNPV,
    bestStrategyName,
    section7520Rate,
    cstFundingAmount,
    cstGrowthRate,
    survivorExemption,
    noExemptionStressTax,
  } = input

  const totalTax = federalTax + stateTax
  const currentYear = new Date().getFullYear()
  const metrics: AdvisoryMetric[] = []

  // 1. Effective Estate Tax Rate
  const effectiveRate = grossEstate > 0 ? (totalTax / grossEstate) * 100 : 0
  metrics.push({
    id: 'effective_rate',
    label: 'Effective Estate Tax Rate',
    scope: 'both',
    value: `${effectiveRate.toFixed(1)}%`,
    subtext: `$${Math.round(totalTax).toLocaleString()} on $${
      Math.round((grossEstate / 1_000_000) * 10) / 10
    }M estate`,
    status: effectiveRate === 0 ? 'good' : effectiveRate < 15 ? 'warning' : 'critical',
    detail:
      effectiveRate === 0
        ? 'Estate is below the federal exemption threshold under current law.'
        : `Combined federal and state tax consumes ${effectiveRate.toFixed(1)}% of the gross estate.`,
  })

  // 2. Cost of Inaction
  // Annual cost = what heirs lose each year no planning is done
  // Approximated as: total tax / remaining planning years (assume 20 years)
  const planningYears = 20
  const costOfInaction = totalTax > 0 ? Math.round(totalTax / planningYears) : 0
  metrics.push({
    id: 'cost_of_inaction',
    label: 'Cost of Inaction',
    scope: 'both',
    value: costOfInaction > 0 ? `$${Math.round(costOfInaction).toLocaleString()}/yr` : '$0/yr',
    subtext:
      noExemptionStressTax !== undefined && noExemptionStressTax > 0
        ? `No-exemption stress: $${Math.round(noExemptionStressTax).toLocaleString()}`
        : 'No current tax exposure',
    status: costOfInaction > 50_000 ? 'critical' : costOfInaction > 10_000 ? 'warning' : 'good',
    detail:
      costOfInaction > 0
        ? `Each year without planning costs heirs an estimated $${Math.round(costOfInaction).toLocaleString()} in avoidable estate tax.`
        : 'Estate is currently below the exemption threshold. Monitor for estate growth; run the no-exemption stress test for downside scenarios.',
  })

  // 3. Exemption Utilization
  const exemptionUsed = Math.min(grossEstate, federalExemption)
  const exemptionUtilPct = federalExemption > 0 ? (exemptionUsed / federalExemption) * 100 : 0
  const unusedExemption = Math.max(0, federalExemption - grossEstate)
  metrics.push({
    id: 'exemption_utilization',
    label: 'Exemption Utilization',
    scope: 'federal',
    value: `${Math.min(100, exemptionUtilPct).toFixed(0)}%`,
    subtext:
      unusedExemption > 0
        ? `$${Math.round((unusedExemption / 1_000_000) * 10) / 10}M unused exemption`
        : 'Exemption fully utilized',
    status: exemptionUtilPct >= 100 ? 'critical' : exemptionUtilPct > 75 ? 'warning' : 'good',
    detail:
      unusedExemption > 0
        ? `$${Math.round(unusedExemption).toLocaleString()} in federal exemption remains unused. Consider gifting or trust strategies to reduce future estate tax exposure as the estate grows.`
        : 'Estate exceeds the available federal exemption.',
  })

  // 4. DSUE at Risk
  const dsueAtRisk = hasSpouse && dsueAvailable > 0
  metrics.push({
    id: 'dsue_at_risk',
    label: 'DSUE at Risk',
    scope: 'federal',
    value: dsueAvailable > 0 ? `$${Math.round((dsueAvailable / 1_000_000) * 10) / 10}M` : 'None',
    subtext: dsueAtRisk
      ? 'Portability elected — at risk if survivor remarries'
      : hasSpouse
        ? 'No DSUE available'
        : 'Single filer',
    status: dsueAtRisk ? 'warning' : 'neutral',
    detail: dsueAtRisk
      ? `The DSUE of $${Math.round(dsueAvailable).toLocaleString()} is at risk if the surviving spouse remarries and the new spouse predeceases them. Consider a Credit Shelter Trust to lock in this exemption permanently.`
      : 'No portability carryover at risk.',
  })

  // 5. Liquidity Coverage Ratio
  const totalLiquidity = liquidAssets + ilitDeathBenefit
  const coverageRatio = totalTax > 0 ? totalLiquidity / totalTax : 999
  metrics.push({
    id: 'liquidity_coverage',
    label: 'Liquidity Coverage',
    scope: 'both',
    value: totalTax === 0 ? 'N/A' : `${coverageRatio.toFixed(1)}x`,
    subtext:
      totalTax === 0
        ? 'No current tax burden'
        : coverageRatio >= 1
          ? `$${Math.round(totalLiquidity).toLocaleString()} available`
          : `Shortfall: $${Math.round(totalTax - totalLiquidity).toLocaleString()}`,
    status:
      totalTax === 0
        ? 'neutral'
        : coverageRatio >= 1.5
          ? 'good'
          : coverageRatio >= 1
            ? 'warning'
            : 'critical',
    detail:
      totalTax === 0
        ? 'No estate tax under current law. Run the no-exemption stress test to assess liquidity under a scenario where the exemption is eliminated.'
        : coverageRatio >= 1
          ? `Sufficient liquidity to cover estimated tax burden of $${Math.round(totalTax).toLocaleString()}.`
          : `Liquidity shortfall of $${Math.round(totalTax - totalLiquidity).toLocaleString()}. Consider an ILIT to provide tax-free death benefit liquidity.`,
  })

  // 6. Strategy NPV
  metrics.push({
    id: 'strategy_npv',
    label: 'Best Strategy NPV',
    scope: 'strategy',
    value: bestStrategyNPV !== undefined ? `$${Math.round(bestStrategyNPV).toLocaleString()}` : 'Not run',
    subtext: bestStrategyName ?? 'Run strategy modules to calculate',
    status: bestStrategyNPV !== undefined ? (bestStrategyNPV > 0 ? 'good' : 'warning') : 'neutral',
    detail:
      bestStrategyNPV !== undefined
        ? `${bestStrategyName} produces a net present value benefit of $${Math.round(bestStrategyNPV).toLocaleString()} to beneficiaries.`
        : 'Run the Gifting, CST, SLAT, GRAT, or Roth Conversion modules to calculate strategy NPV.',
  })

  // 7. GRAT Breakeven Rate
  const gratBreakeven = section7520Rate
  metrics.push({
    id: 'grat_breakeven',
    label: 'GRAT Breakeven Rate',
    scope: 'strategy',
    value: `${(gratBreakeven * 100).toFixed(1)}%`,
    subtext: 'Current §7520 rate — assets must beat this',
    status: gratBreakeven < 0.05 ? 'good' : gratBreakeven < 0.065 ? 'warning' : 'critical',
    detail: `A GRAT transfers appreciation above the §7520 hurdle rate of ${(gratBreakeven * 100).toFixed(1)}% to beneficiaries gift-tax free. Assets expected to grow faster than this rate are strong GRAT candidates.`,
  })

  // 8. CST Crossover Year
  let cstCrossoverYear: number | null = null
  if (cstFundingAmount && cstGrowthRate && survivorExemption) {
    for (let y = 1; y <= 30; y++) {
      const cstVal = cstFundingAmount * Math.pow(1 + cstGrowthRate, y)
      if (cstVal > survivorExemption) {
        cstCrossoverYear = currentYear + y
        break
      }
    }
  }
  metrics.push({
    id: 'cst_crossover',
    label: 'CST Crossover Year',
    scope: 'strategy',
    value: cstCrossoverYear ? `${cstCrossoverYear}` : 'Not modeled',
    subtext: cstCrossoverYear
      ? "CST assets projected to exceed survivor exemption"
      : 'Run CST module to calculate',
    status: cstCrossoverYear ? (cstCrossoverYear - currentYear < 10 ? 'warning' : 'good') : 'neutral',
    detail: cstCrossoverYear
      ? `CST assets are projected to exceed the surviving spouse's exemption around ${cstCrossoverYear}. Estate flow planning should account for this crossover.`
      : 'Model a Credit Shelter Trust in the strategy panels to calculate the crossover year.',
  })

  return { metrics }
}

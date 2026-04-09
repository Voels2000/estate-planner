// Sprint 69 — Roth Conversion Integration Module
//
// Models Roth conversions and their impact on the gross estate projection.
// Reads RMD data from the RetirementTab projection to determine pre-tax IRA balance.
// Converting pre-tax IRA to Roth:
//   - Triggers income tax in conversion year (reduces liquid assets / estate)
//   - Removes future RMDs from taxable income (reduces income tax drag)
//   - Roth balance grows and passes estate-tax free (included in gross estate
//     but income-tax free to beneficiaries — a significant advantage)
//
// Strategy NPV: net present value of conversion benefit vs cost of paying tax now.

export interface RothConversionConfig {
  // Current pre-tax IRA / 401(k) balance
  preIRABalance: number
  // Annual RMD amount (from RetirementTab)
  annualRMD: number
  // Amount to convert per year
  annualConversionAmount: number
  // Number of years to convert
  conversionYears: number
  // Grantor's marginal income tax rate during conversion
  marginalTaxRateDuringConversion: number
  // Beneficiary's marginal income tax rate (for NPV of benefit to heirs)
  beneficiaryMarginalTaxRate: number
  // Expected growth rate of IRA assets
  growthRate: number
  // Discount rate for NPV calculation
  discountRate: number
  // Years until death (for NPV horizon)
  yearsUntilDeath: number
}

export interface RothConversionResult {
  // Total income tax cost of conversions
  totalConversionTaxCost: number
  // Projected Roth balance at death
  projectedRothBalanceAtDeath: number
  // Projected pre-tax IRA balance at death (if no conversion)
  projectedPreTaxBalanceAtDeath: number
  // Estate reduction from tax paid during conversion
  estateReductionFromTaxPayment: number
  // NPV of conversion benefit to beneficiaries
  npvBenefitToBeneficiaries: number
  // Whether conversion is NPV positive
  conversionIsNPVPositive: boolean
  // Optimal conversion amount per year (simplified)
  optimalAnnualConversion: number
  // Advisory notes
  advisoryNotes: string[]
}

export function modelRothConversion(config: RothConversionConfig): RothConversionResult {
  const {
    preIRABalance,
    annualRMD,
    annualConversionAmount,
    conversionYears,
    marginalTaxRateDuringConversion,
    beneficiaryMarginalTaxRate,
    growthRate,
    discountRate,
    yearsUntilDeath,
  } = config

  const advisoryNotes: string[] = []

  // Total tax cost of conversions
  const totalConversionTaxCost = annualConversionAmount * conversionYears * marginalTaxRateDuringConversion

  // Project Roth balance at death (converted amount grows tax-free)
  const totalConverted = annualConversionAmount * conversionYears
  const conversionMidpoint = conversionYears / 2
  const yearsOfGrowth = yearsUntilDeath - conversionMidpoint
  const projectedRothBalanceAtDeath = totalConverted * Math.pow(1 + growthRate, Math.max(0, yearsOfGrowth))

  // Project remaining pre-tax balance at death (reduced by conversions and RMDs)
  const remainingPreTax = Math.max(0, preIRABalance - totalConverted)
  const projectedPreTaxBalanceAtDeath = remainingPreTax * Math.pow(1 + growthRate, yearsUntilDeath)

  // Estate reduction: tax payments during conversion reduce the taxable estate
  const estateReductionFromTaxPayment = totalConversionTaxCost

  // NPV of benefit: beneficiaries receive Roth income-tax free vs pre-tax taxable
  // Benefit = income tax avoided by beneficiaries on Roth vs pre-tax distributions
  const beneficiaryTaxSavedOnRoth = projectedRothBalanceAtDeath * beneficiaryMarginalTaxRate
  const pvBenefit = beneficiaryTaxSavedOnRoth / Math.pow(1 + discountRate, yearsUntilDeath)
  const pvCost = totalConversionTaxCost // Cost paid now, no discounting needed

  const npvBenefitToBeneficiaries = pvBenefit - pvCost
  const conversionIsNPVPositive = npvBenefitToBeneficiaries > 0

  // Optimal conversion: roughly fill up current tax bracket without going higher
  // Simplified: convert up to amount that keeps marginal rate below beneficiary rate
  const optimalAnnualConversion = beneficiaryMarginalTaxRate > marginalTaxRateDuringConversion
    ? annualConversionAmount // Current config is favorable
    : annualConversionAmount * (marginalTaxRateDuringConversion / beneficiaryMarginalTaxRate)

  // Advisory notes
  if (conversionIsNPVPositive) {
    advisoryNotes.push(
      `Roth conversion is NPV positive: $${Math.round(npvBenefitToBeneficiaries).toLocaleString()} ` +
      `net benefit to beneficiaries after accounting for the $${Math.round(totalConversionTaxCost).toLocaleString()} ` +
      `conversion tax cost.`
    )
  } else {
    advisoryNotes.push(
      `Roth conversion is NPV negative under current assumptions. ` +
      `Conversion may still be beneficial if beneficiary tax rates rise significantly ` +
      `or if the grantor's current marginal rate is unusually low (e.g. a low-income year).`
    )
  }

  advisoryNotes.push(
    `Converting $${annualConversionAmount.toLocaleString()}/year over ${conversionYears} years: ` +
    `total tax cost $${Math.round(totalConversionTaxCost).toLocaleString()}. ` +
    `Projected Roth balance at death: $${Math.round(projectedRothBalanceAtDeath).toLocaleString()} ` +
    `(income-tax free to beneficiaries).`
  )

  if (annualRMD > annualConversionAmount) {
    advisoryNotes.push(
      `RMDs of $${Math.round(annualRMD).toLocaleString()}/year exceed the planned conversion amount. ` +
      `Consider converting above the RMD amount in low-income years to reduce the long-term pre-tax balance.`
    )
  }

  advisoryNotes.push(
    `Tax paid on conversions ($${Math.round(totalConversionTaxCost).toLocaleString()}) reduces the ` +
    `taxable gross estate — effectively a tax-free wealth transfer if paid from non-IRA assets.`
  )

  return {
    totalConversionTaxCost,
    projectedRothBalanceAtDeath,
    projectedPreTaxBalanceAtDeath,
    estateReductionFromTaxPayment,
    npvBenefitToBeneficiaries,
    conversionIsNPVPositive,
    optimalAnnualConversion,
    advisoryNotes,
  }
}

// Strategy NPV: compares two strategies on a present value basis
export interface StrategyNPVConfig {
  strategyName: string
  // Annual cash flows (positive = benefit to estate/heirs, negative = cost)
  cashFlows: number[]
  discountRate: number
}

export function calculateStrategyNPV(config: StrategyNPVConfig): number {
  const { cashFlows, discountRate } = config
  return cashFlows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + discountRate, t + 1)
  }, 0)
}

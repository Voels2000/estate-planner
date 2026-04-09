// Sprint 69 — Charitable Strategies Module
// CRT (Charitable Remainder Trust), CLAT (Charitable Lead Annuity Trust), DAF (Donor Advised Fund)
//
// CRT: Grantor transfers assets, receives income stream for life/term, remainder goes to charity.
//      Grantor gets upfront charitable income tax deduction for PV of remainder interest.
//
// CLAT: Charity receives annuity for term, remainder passes to beneficiaries gift/estate-tax free.
//       Appreciation above §7520 rate passes to heirs. Zeroed-out CLAT eliminates taxable gift.
//
// DAF: Simple contribution vehicle. Immediate income tax deduction, flexible grant timing.
//      Assets removed from estate at contribution.

export interface CRTConfig {
  // Assets transferred to CRT
  fundingAmount: number
  // Annual payout rate to grantor (e.g. 0.05 for 5%)
  payoutRate: number
  // CRT term in years (or life expectancy for CRUT)
  termYears: number
  // §7520 rate at establishment
  section7520Rate: number
  // Grantor's marginal income tax rate (for deduction value)
  marginalIncomeTaxRate: number
  // Expected growth rate of CRT assets
  growthRate: number
}

export interface CLATConfig {
  // Assets transferred to CLAT
  fundingAmount: number
  // Annual annuity paid to charity
  annualCharitableAnnuity: number
  // CLAT term in years
  termYears: number
  // §7520 rate at establishment
  section7520Rate: number
  // Expected growth rate of CLAT assets
  growthRate: number
  // Whether zeroed-out (annuity set to eliminate taxable gift)
  isZeroedOut: boolean
}

export interface DAFConfig {
  // Contribution amount to DAF
  contributionAmount: number
  // Type of asset contributed (cash, appreciated securities, real estate)
  assetType: 'cash' | 'appreciated_securities' | 'real_estate'
  // Cost basis (for appreciated assets)
  costBasis: number
  // Grantor's marginal income tax rate
  marginalIncomeTaxRate: number
  // Capital gains rate
  capitalGainsRate: number
}

export interface CRTResult {
  // Annual income to grantor
  annualIncome: number
  // Charitable income tax deduction (PV of remainder interest)
  charitableDeduction: number
  // Tax savings from deduction
  taxSavingsFromDeduction: number
  // PV of remainder to charity
  pvRemainderToCharity: number
  // Estate reduction (assets removed from gross estate)
  estateReduction: number
  // Advisory notes
  advisoryNotes: string[]
}

export interface CLATResult {
  // Taxable gift at establishment
  taxableGift: number
  // Projected remainder to beneficiaries
  projectedRemainder: number
  // Total charitable annuity paid over term
  totalCharitableGiving: number
  // Advisory notes
  advisoryNotes: string[]
}

export interface DAFResult {
  // Immediate charitable income tax deduction
  charitableDeduction: number
  // Tax savings from deduction
  taxSavingsFromDeduction: number
  // Capital gains tax avoided (for appreciated assets)
  capitalGainsTaxAvoided: number
  // Total financial benefit vs outright sale + gift
  totalBenefit: number
  // Estate reduction
  estateReduction: number
  // Advisory notes
  advisoryNotes: string[]
}

function pvAnnuityFactor(rate: number, years: number): number {
  if (rate === 0) return years
  return (1 - Math.pow(1 + rate, -years)) / rate
}

export function applyCRT(config: CRTConfig): CRTResult {
  const {
    fundingAmount,
    payoutRate,
    termYears,
    section7520Rate,
    marginalIncomeTaxRate,
    growthRate,
  } = config

  void growthRate

  const advisoryNotes: string[] = []
  const annualIncome = fundingAmount * payoutRate

  // Charitable deduction = PV of remainder interest
  // PV of remainder = funding - PV of annuity payments at §7520 rate
  const pvFactor = pvAnnuityFactor(section7520Rate, termYears)
  const pvAnnuityStream = annualIncome * pvFactor
  const pvRemainderToCharity = Math.max(0, fundingAmount - pvAnnuityStream)

  // IRS requires remainder to be at least 10% of funding
  const remainderPct = pvRemainderToCharity / fundingAmount
  if (remainderPct < 0.10) {
    advisoryNotes.push(
      `⚠️ IRS 10% Remainder Test: The present value of the charitable remainder ` +
      `(${(remainderPct * 100).toFixed(1)}%) is below the required 10% minimum. ` +
      `Reduce the payout rate or shorten the term to qualify.`
    )
  }

  const charitableDeduction = pvRemainderToCharity
  const taxSavingsFromDeduction = charitableDeduction * marginalIncomeTaxRate

  advisoryNotes.push(
    `CRT provides $${Math.round(annualIncome).toLocaleString()}/year income stream over ${termYears} years. ` +
    `Charitable deduction: $${Math.round(charitableDeduction).toLocaleString()}, ` +
    `saving $${Math.round(taxSavingsFromDeduction).toLocaleString()} in income tax.`
  )

  advisoryNotes.push(
    `All $${fundingAmount.toLocaleString()} transferred to CRT is removed from the gross estate. ` +
    `CRT is ideal for highly appreciated, low-basis assets — avoids immediate capital gains on sale inside the trust.`
  )

  return {
    annualIncome,
    charitableDeduction,
    taxSavingsFromDeduction,
    pvRemainderToCharity,
    estateReduction: fundingAmount,
    advisoryNotes,
  }
}

export function applyCLAT(config: CLATConfig): CLATResult {
  const {
    fundingAmount,
    annualCharitableAnnuity,
    termYears,
    section7520Rate,
    growthRate,
    isZeroedOut,
  } = config

  const advisoryNotes: string[] = []

  // Zeroed-out CLAT: set annuity so PV = funding, eliminating taxable gift
  const pvFactor = pvAnnuityFactor(section7520Rate, termYears)
  const effectiveAnnuity = isZeroedOut
    ? fundingAmount / pvFactor
    : annualCharitableAnnuity

  const pvCharitableInterest = effectiveAnnuity * pvFactor
  const taxableGift = Math.max(0, fundingAmount - pvCharitableInterest)
  const totalCharitableGiving = effectiveAnnuity * termYears

  // Project assets at growth rate, paying out charity annuity each year
  let clatValue = fundingAmount
  for (let y = 0; y < termYears; y++) {
    clatValue *= (1 + growthRate)
    clatValue -= effectiveAnnuity
  }
  const projectedRemainder = Math.max(0, clatValue)

  if (isZeroedOut) {
    advisoryNotes.push(
      `Zeroed-out CLAT: annual charitable annuity of $${Math.round(effectiveAnnuity).toLocaleString()} ` +
      `eliminates the taxable gift. All CLAT growth above the §7520 rate passes to heirs gift-tax free.`
    )
  }

  if (growthRate > section7520Rate) {
    advisoryNotes.push(
      `Projected remainder to beneficiaries: $${Math.round(projectedRemainder).toLocaleString()}. ` +
      `Growth spread: ${((growthRate - section7520Rate) * 100).toFixed(1)}% above §7520 rate.`
    )
  } else {
    advisoryNotes.push(
      `⚠️ CLAT Breakeven: At current growth rate, little or no remainder is projected for beneficiaries. ` +
      `CLATs work best when assets significantly outperform the §7520 hurdle rate.`
    )
  }

  advisoryNotes.push(
    `Total charitable giving over ${termYears}-year term: $${Math.round(totalCharitableGiving).toLocaleString()}.`
  )

  return {
    taxableGift,
    projectedRemainder,
    totalCharitableGiving,
    advisoryNotes,
  }
}

export function applyDAF(config: DAFConfig): DAFResult {
  const {
    contributionAmount,
    assetType,
    costBasis,
    marginalIncomeTaxRate,
    capitalGainsRate,
  } = config

  const advisoryNotes: string[] = []

  // Deduction: cash = full amount; appreciated securities/RE = FMV (full amount)
  const charitableDeduction = contributionAmount
  const taxSavingsFromDeduction = charitableDeduction * marginalIncomeTaxRate

  // Capital gains avoided for appreciated assets
  const unrealizedGain = Math.max(0, contributionAmount - costBasis)
  const capitalGainsTaxAvoided = assetType !== 'cash'
    ? unrealizedGain * capitalGainsRate
    : 0

  const totalBenefit = taxSavingsFromDeduction + capitalGainsTaxAvoided

  if (assetType === 'appreciated_securities') {
    advisoryNotes.push(
      `Contributing appreciated securities avoids $${Math.round(capitalGainsTaxAvoided).toLocaleString()} ` +
      `in capital gains tax on $${Math.round(unrealizedGain).toLocaleString()} of unrealized gain. ` +
      `DAF then sells and reinvests at full FMV with no tax drag.`
    )
  }

  advisoryNotes.push(
    `DAF contribution of $${contributionAmount.toLocaleString()}: ` +
    `income tax savings $${Math.round(taxSavingsFromDeduction).toLocaleString()}, ` +
    `total financial benefit $${Math.round(totalBenefit).toLocaleString()}. ` +
    `Assets removed from gross estate immediately at contribution.`
  )

  advisoryNotes.push(
    `DAF grants can be made to any IRS-qualified charity over time. ` +
    `Deduction is taken in the year of contribution regardless of when grants are made.`
  )

  return {
    charitableDeduction,
    taxSavingsFromDeduction,
    capitalGainsTaxAvoided,
    totalBenefit,
    estateReduction: contributionAmount,
    advisoryNotes,
  }
}

// Sprint 69 — Grantor Retained Annuity Trust (GRAT) Module
//
// A GRAT transfers appreciation above the IRS §7520 hurdle rate to beneficiaries
// gift-tax free. The grantor retains an annuity for the trust term. If the grantor
// dies during the term, the GRAT assets are pulled back into the gross estate
// (mortality risk).
//
// Zeroed-out GRAT: annuity set so present value = funding amount, producing
// a $0 taxable gift. All appreciation above §7520 rate passes to beneficiaries.
//
// Rolling GRAT strategy: series of short-term (2-year) GRATs that re-invest
// the annuity payments into new GRATs, capturing appreciation continuously.

export interface GRATConfig {
  // Amount funded into the GRAT
  fundingAmount: number
  // GRAT term in years
  termYears: number
  // Expected annual growth rate of GRAT assets
  expectedGrowthRate: number
  // IRS §7520 rate for the month of establishment (e.g. 0.052 for 5.2%)
  section7520Rate: number
  // Whether this is a zeroed-out GRAT (annuity set to eliminate taxable gift)
  isZeroedOut: boolean
  // Whether to model as a rolling strategy (series of 2-year GRATs)
  isRollingStrategy: boolean
  // Number of rolling GRATs if rolling strategy
  numberOfRollingGRATs?: number
  // Grantor age at establishment (for mortality risk assessment)
  grantorAge: number
  // Death year for mortality risk check
  deathYear: number
  // Year GRAT is established
  establishmentYear: number
}

export interface GRATResult {
  // Annual annuity payment back to grantor
  annualAnnuityPayment: number
  // Taxable gift at establishment (0 for zeroed-out)
  taxableGift: number
  // Projected remainder passing to beneficiaries (above §7520 hurdle)
  projectedRemainder: number
  // IRR of the GRAT strategy
  irrPct: number
  // Whether grantor mortality risk exists (dies during term)
  mortalityRiskFlag: boolean
  // Mortality risk note
  mortalityRiskNote: string
  // Rolling strategy total remainder across all GRATs
  rollingStrategyTotalRemainder?: number
  // Advisory notes
  advisoryNotes: string[]
}

// Present value of annuity factor: PV = 1 - (1+r)^-n / r
function pvAnnuityFactor(rate: number, years: number): number {
  if (rate === 0) return years
  return (1 - Math.pow(1 + rate, -years)) / rate
}

export function applyGRAT(config: GRATConfig): GRATResult {
  const {
    fundingAmount,
    termYears,
    expectedGrowthRate,
    section7520Rate,
    isZeroedOut,
    isRollingStrategy,
    numberOfRollingGRATs = 5,
    grantorAge,
    deathYear,
    establishmentYear,
  } = config

  void grantorAge

  const advisoryNotes: string[] = []

  // Zeroed-out annuity: set so PV of annuity = funding amount at §7520 rate
  const pvFactor = pvAnnuityFactor(section7520Rate, termYears)
  const annualAnnuityPayment = isZeroedOut
    ? fundingAmount / pvFactor
    : fundingAmount * 0.1 // Default 10% annuity if not zeroed out

  const taxableGift = isZeroedOut
    ? 0
    : Math.max(0, fundingAmount - annualAnnuityPayment * pvFactor)

  // Project GRAT assets at expected growth rate
  let gratValue = fundingAmount
  for (let y = 1; y <= termYears; y++) {
    gratValue *= (1 + expectedGrowthRate)
    gratValue -= annualAnnuityPayment
  }
  const projectedRemainder = Math.max(0, gratValue)

  // IRR: grantor puts in fundingAmount, gets back annuity payments + remainder passes to heirs
  // Simplified: remainder / fundingAmount annualized
  const irrPct = projectedRemainder > 0
    ? Math.pow(projectedRemainder / fundingAmount, 1 / termYears) - 1
    : 0

  // Mortality risk: if grantor expected death year falls within GRAT term
  const gratEndYear = establishmentYear + termYears
  const mortalityRiskFlag = deathYear < gratEndYear
  const mortalityRiskNote = mortalityRiskFlag
    ? `⚠️ Mortality Risk: Selected death year (${deathYear}) falls within the GRAT term ending ${gratEndYear}. ` +
      `If the grantor dies during the term, GRAT assets are included in the gross estate. ` +
      `Consider shorter-term or rolling GRATs to reduce this risk.`
    : `Grantor is projected to survive the GRAT term (ending ${gratEndYear}). Mortality risk is low.`

  // Rolling strategy
  let rollingStrategyTotalRemainder: number | undefined
  if (isRollingStrategy) {
    // Each 2-year GRAT re-invests annuity into next GRAT
    let cumulativeRemainder = 0
    let currentFunding = fundingAmount
    for (let g = 0; g < numberOfRollingGRATs; g++) {
      const pv = pvAnnuityFactor(section7520Rate, 2)
      const annuity = currentFunding / pv
      let val = currentFunding
      for (let y = 0; y < 2; y++) {
        val *= (1 + expectedGrowthRate)
        val -= annuity
      }
      cumulativeRemainder += Math.max(0, val)
      currentFunding = annuity * 2 // Re-invest annuity payments into next GRAT
    }
    rollingStrategyTotalRemainder = cumulativeRemainder
    advisoryNotes.push(
      `Rolling GRAT strategy (${numberOfRollingGRATs} × 2-year GRATs): projected total remainder ` +
      `$${Math.round(cumulativeRemainder).toLocaleString()} vs single GRAT remainder ` +
      `$${Math.round(projectedRemainder).toLocaleString()}.`
    )
  }

  // Advisory notes
  if (expectedGrowthRate <= section7520Rate) {
    advisoryNotes.push(
      `⚠️ GRAT Breakeven Risk: Expected growth rate (${(expectedGrowthRate * 100).toFixed(1)}%) ` +
      `is at or below the §7520 hurdle rate (${(section7520Rate * 100).toFixed(1)}%). ` +
      `The GRAT will produce no remainder for beneficiaries. GRATs work best when assets ` +
      `are expected to significantly outperform the §7520 rate.`
    )
  } else {
    advisoryNotes.push(
      `GRAT projected remainder: $${Math.round(projectedRemainder).toLocaleString()} passes ` +
      `to beneficiaries gift-tax free. Growth spread above §7520 rate: ` +
      `${((expectedGrowthRate - section7520Rate) * 100).toFixed(1)}%.`
    )
  }

  if (isZeroedOut) {
    advisoryNotes.push(
      `Zeroed-out GRAT: annual annuity of $${Math.round(annualAnnuityPayment).toLocaleString()} ` +
      `eliminates the taxable gift. All appreciation above the §7520 rate passes free of gift tax.`
    )
  }

  advisoryNotes.push(mortalityRiskNote)

  return {
    annualAnnuityPayment,
    taxableGift,
    projectedRemainder,
    irrPct,
    mortalityRiskFlag,
    mortalityRiskNote,
    rollingStrategyTotalRemainder,
    advisoryNotes,
  }
}

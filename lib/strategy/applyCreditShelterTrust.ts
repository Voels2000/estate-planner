// Sprint 67 — Credit Shelter Trust (CST) / Bypass Trust Strategy Module
// Also known as: Bypass Trust, Family Trust, B Trust
//
// A CST funds at the first spouse's death up to the available exemption amount.
// Assets in the CST are NOT included in the surviving spouse's estate at second death.
// The crossover point is the estate size where a CST begins to save more than
// portability alone (DSUE election).

import { ProjectionScenario } from '@/lib/types/projection-scenario'

export interface CSTConfig {
  // Gross estate at first death
  grossEstateAtFirstDeath: number
  // Federal exemption at first death (from federal_tax_config)
  federalExemptionAtFirstDeath: number
  // Projected growth rate of CST assets (decimal, e.g. 0.06 for 6%)
  cstGrowthRate: number
  // Years between first and second death
  yearsBetweenDeaths: number
  // Federal exemption at second death (may differ from first death)
  federalExemptionAtSecondDeath: number
  // Surviving spouse's own assets (outside of CST)
  survivingSpouseAssets: number
  // Law scenario for second death tax calculation
  lawScenario: 'current_law' | 'no_exemption'
}

export interface CSTResult {
  // Amount funded into the CST at first death
  cstFundingAmount: number
  // Projected value of CST at second death (grown)
  cstValueAtSecondDeath: number
  // Estate tax saved by using CST vs portability alone
  taxSavingsVsPortability: number
  // Estate tax owed at second death with CST strategy
  taxWithCST: number
  // Estate tax owed at second death with portability only (no CST)
  taxWithPortabilityOnly: number
  // Whether CST produces savings over portability
  cstBeatPortability: boolean
  // Crossover year (if CST funding grows to exceed surviving spouse exemption)
  crossoverYear: number | null
  // Net to heirs with CST
  netToHeirsWithCST: number
  // Net to heirs with portability only
  netToHeirsWithPortability: number
  // Advisory notes
  advisoryNotes: string[]
}

const ESTATE_TAX_RATE = 0.40 // Federal estate tax top rate

function calcEstateTax(
  taxableEstate: number,
  exemption: number,
  lawScenario: 'current_law' | 'no_exemption'
): number {
  if (lawScenario === 'no_exemption') {
    return taxableEstate * ESTATE_TAX_RATE
  }
  const effectiveExemption = exemption
  const taxable = Math.max(0, taxableEstate - effectiveExemption)
  return taxable * ESTATE_TAX_RATE
}

export function applyCreditShelterTrust(
  scenario: ProjectionScenario,
  config: CSTConfig
): CSTResult {
  void scenario

  const {
    grossEstateAtFirstDeath,
    federalExemptionAtFirstDeath,
    cstGrowthRate,
    yearsBetweenDeaths,
    federalExemptionAtSecondDeath,
    survivingSpouseAssets,
    lawScenario,
  } = config

  const advisoryNotes: string[] = []

  // CST funds up to the available exemption at first death
  const cstFundingAmount = Math.min(grossEstateAtFirstDeath / 2, federalExemptionAtFirstDeath)

  // Remaining assets pass to surviving spouse (marital deduction — no tax at first death)
  const assetsToSurvivingSpouse = grossEstateAtFirstDeath - cstFundingAmount

  // CST grows outside surviving spouse's estate
  const cstValueAtSecondDeath = cstFundingAmount * Math.pow(1 + cstGrowthRate, yearsBetweenDeaths)

  // --- WITH CST ---
  // Surviving spouse's taxable estate = their own assets + inherited assets (NOT CST)
  const survivingSpouseEstate = survivingSpouseAssets + assetsToSurvivingSpouse
  const taxWithCST = calcEstateTax(survivingSpouseEstate, federalExemptionAtSecondDeath, lawScenario)
  const netToHeirsWithCST = survivingSpouseEstate + cstValueAtSecondDeath - taxWithCST

  // --- WITH PORTABILITY ONLY (no CST) ---
  // All assets pass to surviving spouse; DSUE = first spouse's unused exemption
  const dsue = federalExemptionAtFirstDeath // Full exemption ported
  const combinedExemption = federalExemptionAtSecondDeath + dsue
  const totalEstateAtSecondDeathPortability =
    (grossEstateAtFirstDeath * Math.pow(1 + cstGrowthRate, yearsBetweenDeaths)) + survivingSpouseAssets
  const taxWithPortabilityOnly = calcEstateTax(
    totalEstateAtSecondDeathPortability,
    combinedExemption,
    lawScenario
  )
  const netToHeirsWithPortability = totalEstateAtSecondDeathPortability - taxWithPortabilityOnly

  const taxSavingsVsPortability = taxWithPortabilityOnly - taxWithCST
  const cstBeatPortability = taxSavingsVsPortability > 0

  // Crossover analysis — find year CST value exceeds surviving spouse's exemption
  let crossoverYear: number | null = null
  for (let y = 1; y <= 30; y++) {
    const cstVal = cstFundingAmount * Math.pow(1 + cstGrowthRate, y)
    if (cstVal > federalExemptionAtSecondDeath) {
      crossoverYear = new Date().getFullYear() + y
      break
    }
  }

  // Advisory notes
  if (cstBeatPortability) {
    advisoryNotes.push(
      `CST saves $${taxSavingsVsPortability.toLocaleString()} in estate tax vs portability alone ` +
      `by sheltering $${cstValueAtSecondDeath.toLocaleString()} of growth outside the surviving spouse's estate.`
    )
  } else {
    advisoryNotes.push(
      'For this estate size, portability produces equivalent results to a CST. ' +
      'A CST may still be appropriate for state estate tax planning or asset protection.'
    )
  }

  advisoryNotes.push(
    'A Credit Shelter Trust locks in the first-death exemption as a permanent credit at the ' +
    'second death, protecting that exemption from erosion due to growth of the surviving ' +
    "spouse's estate and any future legislative changes. Portability alone does not provide " +
    'this protection.'
  )

  if (crossoverYear) {
    advisoryNotes.push(
      `At the current growth rate, CST assets are projected to exceed the surviving spouse's ` +
      `exemption around ${crossoverYear}. Estate flow planning should account for this crossover.`
    )
  }

  return {
    cstFundingAmount,
    cstValueAtSecondDeath,
    taxSavingsVsPortability,
    taxWithCST,
    taxWithPortabilityOnly,
    cstBeatPortability,
    crossoverYear,
    netToHeirsWithCST,
    netToHeirsWithPortability,
    advisoryNotes,
  }
}

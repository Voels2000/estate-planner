import type { MyEstateStrategyHorizonsResult, StrategyHorizonColumn } from '@/lib/my-estate-strategy/horizonSnapshots'

export type MeetingPrepHorizonColumn = {
  label: string
  grossEstate: number | null
  totalTax: number | null
  federalTax: number | null
  stateTax: number | null
}

export type MeetingPrepHorizonBrief = {
  current_gross_estate: number | null
  current_estimated_tax: number | null
  estimated_tax_state: number | null
  estimated_tax_state_with_cst: number | null
  cst_benefit: number | null
  has_portability_gap: boolean | null
  gross_estate: number | null
  estate_tax: number | null
  net_to_heirs: number | null
  cost_of_inaction: number | null
  cst_benefit_at_death: number | null
  has_projection: boolean
  horizon_columns: MeetingPrepHorizonColumn[]
  at_death_label: string | null
}

function columnToBrief(col: StrategyHorizonColumn): MeetingPrepHorizonColumn {
  return {
    label: col.headerTitle,
    grossEstate: col.grossEstate,
    totalTax: col.totalTaxLiability,
    federalTax: col.federalTaxEstimate,
    stateTax: col.stateTax,
  }
}

function netAfterTax(gross: number | null, tax: number | null): number | null {
  if (gross === null || tax === null) return null
  return Math.max(0, gross - tax)
}

/** Map advisor strategy horizons into meeting-brief tax fields (canonical engine). */
export function meetingPrepBriefFromHorizons(
  horizons: MyEstateStrategyHorizonsResult | null | undefined,
): MeetingPrepHorizonBrief | null {
  if (!horizons) return null

  const { today, tenYear, twentyYear, atDeath } = horizons
  const horizon_columns = [
    columnToBrief(today),
    columnToBrief(tenYear),
    columnToBrief(twentyYear),
    columnToBrief(atDeath),
  ]

  const hasHorizonTax = horizon_columns.some((c) => c.totalTax !== null)
  const hasHorizonGross = horizon_columns.some((c) => c.grossEstate !== null)

  return {
    current_gross_estate: today.grossEstate,
    current_estimated_tax: today.totalTaxLiability,
    estimated_tax_state: today.stateTax,
    estimated_tax_state_with_cst: today.stateTaxWithCST,
    cst_benefit: today.cstBenefit,
    has_portability_gap: today.hasPortabilityGap,
    gross_estate: atDeath.grossEstate,
    estate_tax: atDeath.totalTaxLiability,
    net_to_heirs: netAfterTax(atDeath.grossEstate, atDeath.totalTaxLiability),
    cost_of_inaction: atDeath.totalTaxLiability,
    cst_benefit_at_death: horizons.cstBenefitAtDeath,
    has_projection: hasHorizonTax || hasHorizonGross,
    horizon_columns,
    at_death_label: atDeath.headerTitle,
  }
}

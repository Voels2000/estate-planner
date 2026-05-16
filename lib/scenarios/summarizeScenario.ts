import type { YearRow } from '@/lib/calculations/projection-complete'

export type ScenarioSummary = {
  rows: YearRow[]
  portfolioAtRetirement: number
  peakPortfolio: number
  finalPortfolio: number
  avgAnnualTaxRetirement: number
  fundsOutlast: boolean
}

export function summarizeScenario(rows: YearRow[], retirementAge: number): ScenarioSummary {
  const retirementRows = rows.filter((r) => r.age_person1 >= retirementAge)
  const portfolioAtRetirement = rows.find((r) => r.age_person1 >= retirementAge)?.net_worth ?? 0
  const peakPortfolio = Math.max(...rows.map((r) => r.net_worth))
  const finalPortfolio = rows[rows.length - 1]?.net_worth ?? 0
  const avgAnnualTaxRetirement =
    retirementRows.length > 0
      ? Math.round(retirementRows.reduce((s, r) => s + r.tax_total, 0) / retirementRows.length)
      : 0
  return {
    rows,
    portfolioAtRetirement,
    peakPortfolio,
    finalPortfolio,
    avgAnnualTaxRetirement,
    fundsOutlast: finalPortfolio > 0,
  }
}

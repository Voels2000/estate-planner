/**
 * Derives headline metrics (peak net worth, retirement-phase average tax, etc.)
 * from mapped `ProjectionYear` arrays for summary cards.
 */

import type { ProjectionYear } from '@/lib/projections/types'

type ProjectionSummary = {
  retirementRow: ProjectionYear | undefined
  peakNetWorth: number
  fundsOutlast: boolean
  avgRetirementTax: number
}

export function getProjectionSummary(projections: ProjectionYear[]): ProjectionSummary {
  const retirementRow = projections.find((p) => p.phase === 'retirement')
  const finalRow = projections[projections.length - 1]
  const peakNetWorth = projections.length > 0 ? Math.max(...projections.map((p) => p.net_worth)) : 0
  const fundsOutlast = (finalRow?.portfolio ?? 0) > 0
  const retirementRows = projections.filter((p) => p.phase === 'retirement')
  const avgRetirementTax =
    retirementRows.length > 0
      ? Math.round(retirementRows.reduce((sum, row) => sum + row.taxes, 0) / retirementRows.length)
      : 0

  return {
    retirementRow,
    peakNetWorth,
    fundsOutlast,
    avgRetirementTax,
  }
}

import type { ProjectionYear } from '@/lib/projections/types'
import { getProjectionSummary } from '@/lib/projections/selectors/getProjectionSummary'

export type ProjectionSummaryCard = {
  label: string
  value: string
  sub: string
  highlight?: 'green' | 'red' | 'amber'
}

type BuildProjectionSummaryCardsInput = {
  projections: ProjectionYear[]
  person1RetirementAge: number | null
  formatDollars: (value: number) => string
}

type BuildProjectionSummaryCardsResult = {
  peakNetWorth: number
  cards: ProjectionSummaryCard[]
}

export function buildProjectionSummaryCards(
  input: BuildProjectionSummaryCardsInput,
): BuildProjectionSummaryCardsResult {
  const { retirementRow, peakNetWorth, fundsOutlast, avgRetirementTax } = getProjectionSummary(input.projections)
  const retirementAgeLabel = `Age ${input.person1RetirementAge ?? '—'}`

  return {
    peakNetWorth,
    cards: [
      {
        label: 'Net Worth at Retirement',
        value: input.formatDollars(retirementRow?.net_worth ?? 0),
        sub: `${retirementAgeLabel} · includes RE & business`,
      },
      {
        label: 'Financial Portfolio at Retirement',
        value: input.formatDollars(retirementRow?.portfolio ?? 0),
        sub: `${retirementAgeLabel} · investable assets only`,
      },
      {
        label: 'Avg Tax in Retirement',
        value: input.formatDollars(avgRetirementTax),
        sub: 'Federal + state/yr',
        highlight: 'amber',
      },
      {
        label: 'Funds Outlast',
        value: fundsOutlast ? 'Yes ✓' : 'No ✗',
        sub: fundsOutlast ? 'On track' : 'Review plan',
        highlight: fundsOutlast ? 'green' : 'red',
      },
    ],
  }
}

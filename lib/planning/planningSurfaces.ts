/** Consumer planning surfaces that share projection data but serve different questions. */
export type PlanningSurfaceId = 'projections' | 'complete' | 'scenarios'

export const PLANNING_SURFACES: {
  id: PlanningSurfaceId
  href: string
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    id: 'projections',
    href: '/projections',
    label: 'Projections',
    shortLabel: 'Projections',
    description: 'Retirement-focused summary — net worth at retirement, taxes, and funds outlast.',
  },
  {
    id: 'complete',
    href: '/complete',
    label: 'Lifetime Snapshot',
    shortLabel: 'Lifetime',
    description: 'Full year-by-year table — income, taxes, expenses, assets, and estate columns.',
  },
  {
    id: 'scenarios',
    href: '/scenarios',
    label: 'Scenarios',
    shortLabel: 'Scenarios',
    description: 'What-if comparisons — change retirement age, state, or growth and compare side by side.',
  },
]

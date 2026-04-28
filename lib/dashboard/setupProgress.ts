export type DashboardSetupStep = {
  key: string
  label: string
  href: string
  done: boolean
}

type BuildSetupProgressInput = {
  hasProfileBasics: boolean
  assetsCount: number
  liabilitiesCount: number
  incomeCount: number
  expensesCount: number
  hasLiveProjectionOutput: boolean
}

export function buildDashboardSetupProgress(input: BuildSetupProgressInput): {
  setupSteps: DashboardSetupStep[]
  completedSteps: number
  progressPct: number
} {
  const setupSteps: DashboardSetupStep[] = [
    { key: 'profile', label: 'Complete your profile', href: '/profile', done: input.hasProfileBasics },
    { key: 'assets', label: 'Add your assets', href: '/assets', done: input.assetsCount > 0 },
    { key: 'liabilities', label: 'Add your liabilities', href: '/liabilities', done: input.liabilitiesCount > 0 },
    { key: 'income', label: 'Add income sources', href: '/income', done: input.incomeCount > 0 },
    { key: 'expenses', label: 'Add your expenses', href: '/expenses', done: input.expensesCount > 0 },
    { key: 'projections', label: 'Run a projection', href: '/projections', done: input.hasLiveProjectionOutput },
  ]
  const completedSteps = setupSteps.filter((step) => step.done).length
  const progressPct = Math.round((completedSteps / setupSteps.length) * 100)
  return { setupSteps, completedSteps, progressPct }
}

export interface DashboardUnlockInput {
  profileComplete: boolean
  hasAssets: boolean
  hasIncome: boolean
}

export function canUnlockDashboard(input: DashboardUnlockInput): boolean {
  return input.profileComplete && input.hasAssets && input.hasIncome
}

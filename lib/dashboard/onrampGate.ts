/**
 * shouldShowOnramp
 *
 * Returns true (show onramp) when the user hasn't yet provided enough
 * data for the completed dashboard to be meaningful.
 *
 * Unlock rule: isMinimumViableProfile + assets>0 + income>0
 * (see canUnlockDashboard — wizard and estate score are not gates).
 */

import {
  canUnlockDashboard,
  type DashboardUnlockInput,
} from '@/lib/dashboard/canUnlockDashboard'

export type OnrampGateInput = DashboardUnlockInput

export function shouldShowOnramp(input: OnrampGateInput): boolean {
  return !canUnlockDashboard(input)
}

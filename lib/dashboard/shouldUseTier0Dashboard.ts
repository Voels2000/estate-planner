import type { UserAccess } from '@/lib/get-user-access'

/**
 * Tier 0 dashboard slice (PR 3): ex-subscribers and never-subscribed users after app trial.
 * Trial users (effective tier 3) and paid tiers use the full dashboard loader.
 */
export function shouldUseTier0Dashboard(access: UserAccess): boolean {
  if (access.isAdvisor || access.isAdvisorClient || access.isAdmin) return false
  if (access.isTrial) return false
  return access.tier === 0
}

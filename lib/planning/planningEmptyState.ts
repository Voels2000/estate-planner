/**
 * Empty-state CTAs when projection rows are missing.
 *
 * **Do not merge TIER2 and TIER3 into one list.** They serve different surfaces:
 *
 * - **TIER2** (`/projections`, `/complete`): Rows come from `computeCompleteProjection` on
 *   every server render once profile inputs are sufficient — no `generate-base-case` step.
 *   The generate link pointed tier-2 users at tier-3 `/my-estate-strategy` (upgrade wall).
 *
 * - **TIER3** (estate horizons / `projection_scenarios`): Base case generation is required
 *   for persisted scenario outputs. Use on tier-3+ surfaces only (e.g. inline generate on
 *   `/my-estate-strategy`, not on lifetime snapshot or projections).
 */

export const PLANNING_MISSING_PROJECTION_ACTIONS_TIER2 = [
  { href: '/profile', label: 'Complete your profile →' },
  { href: '/scenarios', label: 'Add planning details →' },
] as const

export const PLANNING_MISSING_PROJECTION_ACTIONS_TIER3 = [
  { href: '/profile', label: 'Complete profile →' },
  { href: '/my-estate-strategy', label: 'Generate estate plan →' },
] as const

/** @deprecated Use TIER2 on `/projections` and `/complete`; TIER3 only where base_case generate applies. */
export const PLANNING_MISSING_PROJECTION_ACTIONS = PLANNING_MISSING_PROJECTION_ACTIONS_TIER3

export function planningMissingProjectionActions(userTier: number) {
  return userTier >= 3
    ? [...PLANNING_MISSING_PROJECTION_ACTIONS_TIER3]
    : [...PLANNING_MISSING_PROJECTION_ACTIONS_TIER2]
}

export const PLANNING_NO_HOUSEHOLD_ACTIONS = [
  { href: '/profile', label: 'Go to Profile →' },
] as const

/** Copy when household exists but `computeCompleteProjection` returns no rows. */
export const PLANNING_MISSING_PROJECTION_DESCRIPTION =
  'Add birth year, income, and assets on your profile so we can build your year-by-year snapshot.'

export const PLANNING_MISSING_PROJECTION_DESCRIPTION_PROJECTIONS =
  'Add birth year, income, and assets on your profile so we can build your retirement projections.'

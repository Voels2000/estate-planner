/**
 * shouldShowOnramp
 *
 * Returns true (show onramp) when the user hasn't yet provided enough
 * data for the completed dashboard to be meaningful.
 *
 * Gate logic (any one true → show onramp):
 *   1. Wizard not completed — user hasn't finished guided setup
 *   2. Foundation score < ONRAMP_SCORE_THRESHOLD — not enough data for projections
 *   3. No household data at all — empty account
 *
 * Once ALL three conditions are false, the completed dashboard renders.
 */

export interface OnrampGateInput {
  /** onboarding_wizard_completed_at from profiles row — null if not done */
  wizardCompletedAt: string | null
  /** Score 0–100 from estate_health_scores. Null if never computed. */
  foundationScore: number | null
  /** True if household has any assets or income */
  hasAnyHouseholdData: boolean
}

/**
 * THRESHOLD RATIONALE
 *
 * 60% foundation score was chosen because:
 * - At 60%+ the estate tax snapshot has enough inputs to show a real number
 * - Below 60%, gross estate / headroom figures are likely incomplete or $0
 * - The score engine awards points per section — 60% means ~3–4 sections complete
 *
 * Adjust ONRAMP_SCORE_THRESHOLD here if product decides on a different cutoff.
 */
export const ONRAMP_SCORE_THRESHOLD = 60

export function shouldShowOnramp({
  wizardCompletedAt,
  foundationScore,
  hasAnyHouseholdData,
}: OnrampGateInput): boolean {
  const wizardComplete = wizardCompletedAt !== null
  const scoreAboveThreshold = (foundationScore ?? 0) >= ONRAMP_SCORE_THRESHOLD
  return !wizardComplete || !scoreAboveThreshold || !hasAnyHouseholdData
}

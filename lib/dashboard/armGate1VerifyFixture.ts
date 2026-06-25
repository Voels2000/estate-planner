import type { SupabaseClient } from '@supabase/supabase-js'
import { ONRAMP_SCORE_THRESHOLD, shouldShowOnramp } from '@/lib/dashboard/onrampGate'
import { isProjectionStale } from '@/lib/projections/staleness'

export type Gate1ArmResult = {
  /** Household would enqueue background recompute on the heavy dashboard path. */
  heavyPathWouldTrigger: boolean
  staleReason: string
  /** Consumer reaches DashboardBody (not onboarding onramp). */
  reachesCompletedDashboard: boolean
  armedInputChangeMs: number
  projectionCalculatedAt: string | null
  baseCaseScenarioId: string | null
}

const GATE1_ASSET_NAME = 'Gate1 verify asset'

/**
 * Arm e2e-consumer-canceled so a heavy-path dashboard load would call
 * triggerBackgroundBaseCaseAndRecompute (stale projection + completed dashboard).
 */
export async function armGate1CanceledPersonaFixture(
  admin: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<Gate1ArmResult> {
  const now = new Date()
  const staleInputAt = now.toISOString()
  const oldHealthComputedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  await admin
    .from('profiles')
    .update({
      onboarding_wizard_completed_at: staleInputAt,
      updated_at: staleInputAt,
    })
    .eq('id', userId)

  const { data: existingAsset } = await admin
    .from('assets')
    .select('id')
    .eq('owner_id', userId)
    .eq('name', GATE1_ASSET_NAME)
    .maybeSingle()

  if (existingAsset?.id) {
    await admin
      .from('assets')
      .update({ value: 500_000, updated_at: staleInputAt })
      .eq('id', existingAsset.id)
  } else {
    await admin.from('assets').insert({
      owner_id: userId,
      name: GATE1_ASSET_NAME,
      type: 'taxable_brokerage',
      value: 500_000,
      updated_at: staleInputAt,
    })
  }

  await admin.from('estate_health_scores').upsert(
    {
      household_id: householdId,
      score: ONRAMP_SCORE_THRESHOLD,
      computed_at: oldHealthComputedAt,
      updated_at: oldHealthComputedAt,
      recommendations: { recommendations: [] },
    },
    { onConflict: 'household_id' },
  )

  const { data: householdBefore } = await admin
    .from('households')
    .select('base_case_scenario_id')
    .eq('id', householdId)
    .single()

  const baseCaseScenarioId = householdBefore?.base_case_scenario_id ?? null
  let projectionCalculatedAt: string | null = null

  if (baseCaseScenarioId) {
    const oldProjectionAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await admin
      .from('projection_scenarios')
      .update({ calculated_at: oldProjectionAt, updated_at: oldProjectionAt })
      .eq('id', baseCaseScenarioId)
    projectionCalculatedAt = oldProjectionAt
  }

  await admin
    .from('households')
    .update({
      updated_at: staleInputAt,
      projection_inputs_hash: null,
    })
    .eq('id', householdId)

  const armedInputChangeMs = now.getTime()
  const heavyPathWouldTrigger = isProjectionStale({
    baseCaseScenarioId,
    projectionCalculatedAt,
    latestInputChangeMs: armedInputChangeMs,
  })

  const staleReason = !baseCaseScenarioId
    ? 'missing base_case_scenario_id'
    : !projectionCalculatedAt
      ? 'missing projection calculated_at'
      : 'household/input change newer than projection calculated_at'

  const reachesCompletedDashboard = !shouldShowOnramp({
    wizardCompletedAt: staleInputAt,
    foundationScore: ONRAMP_SCORE_THRESHOLD,
    hasAnyHouseholdData: true,
  })

  return {
    heavyPathWouldTrigger,
    staleReason,
    reachesCompletedDashboard,
    armedInputChangeMs,
    projectionCalculatedAt,
    baseCaseScenarioId,
  }
}

/** Same debounce as triggerBackgroundBaseCaseAndRecompute + buffer for Vercel after(). */
export const GATE1_DEBOUNCE_WAIT_MS = 3_000 + 3_500

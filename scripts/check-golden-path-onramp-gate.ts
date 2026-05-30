/**
 * Verify golden-path E2E user passes dashboard onramp gate (score ≥ 60).
 * Usage: dotenv -e .env.local -e .env.test -- npx tsx scripts/check-golden-path-onramp-gate.ts
 */
import { E2E_IDENTITIES } from './e2e-test-identities'
import { initSupabaseEnv } from './seed-e2e-lib'
import { createAdminClient } from '../lib/supabase/admin'
import { checkHouseholdHasData } from '../lib/onboarding/checkHouseholdHasData'
import { shouldShowOnramp, ONRAMP_SCORE_THRESHOLD } from '../lib/dashboard/onrampGate'

async function main() {
  initSupabaseEnv()
  const admin = createAdminClient()
  const email = E2E_IDENTITIES.goldenPathStage1.email

  const { data: profile } = await admin
    .from('profiles')
    .select('id, onboarding_wizard_completed_at')
    .eq('email', email)
    .maybeSingle()

  if (!profile) {
    console.error('No profile for', email)
    process.exit(1)
  }

  const { data: household } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', profile.id)
    .maybeSingle()

  const { data: scoreRow } = household
    ? await admin
        .from('estate_health_scores')
        .select('score, computed_at')
        .eq('household_id', household.id)
        .maybeSingle()
    : { data: null }

  const hasData = await checkHouseholdHasData(admin, profile.id)

  const showOnramp = shouldShowOnramp({
    wizardCompletedAt: profile.onboarding_wizard_completed_at ?? null,
    foundationScore: scoreRow?.score ?? null,
    hasAnyHouseholdData: hasData,
  })

  console.log(JSON.stringify({
    email,
    householdId: household?.id ?? null,
    wizardCompletedAt: profile.onboarding_wizard_completed_at,
    score: scoreRow?.score ?? null,
    computedAt: scoreRow?.computed_at ?? null,
    hasAnyHouseholdData: hasData,
    onrampThreshold: ONRAMP_SCORE_THRESHOLD,
    wouldShowOnramp: showOnramp,
  }, null, 2))

  if (showOnramp) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

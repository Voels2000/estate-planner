/**
 * Verify golden-path E2E user passes dashboard onramp gate (profile + assets + income).
 * Usage: dotenv -e .env.local -e .env.test -- npx tsx scripts/check-golden-path-onramp-gate.ts
 */
import { E2E_IDENTITIES } from './e2e-test-identities'
import { initSupabaseEnv } from './seed-e2e-lib'
import { createAdminClient } from '../lib/supabase/admin'
import { fetchSetupProgressCounts } from '../lib/consumer/setupProgressCounts'
import { shouldShowOnramp } from '../lib/dashboard/onrampGate'
import { isMinimumViableProfile } from '../lib/estate/profileGate'

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
    .select('id, person1_name, state_primary, filing_status, person1_birth_year')
    .eq('owner_id', profile.id)
    .maybeSingle()

  const setupProgress = await fetchSetupProgressCounts(admin, profile.id)
  const profileComplete = isMinimumViableProfile(household ?? {}).complete

  const showOnramp = shouldShowOnramp({
    profileComplete,
    hasAssets: setupProgress.assets > 0,
    hasIncome: setupProgress.income > 0,
  })

  console.log(JSON.stringify({
    email,
    householdId: household?.id ?? null,
    profileComplete,
    assets: setupProgress.assets,
    income: setupProgress.income,
    wizardCompletedAt: profile.onboarding_wizard_completed_at,
    wouldShowOnramp: showOnramp,
  }, null, 2))

  if (showOnramp) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

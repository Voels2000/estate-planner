/**
 * Consumer dashboard (server shell).
 *
 * Route: `/dashboard`
 *
 * Gate: `shouldShowOnramp()` → lightweight onramp, else stream full body via Suspense.
 * See `docs/dashboard-page-patch.md` for integration notes.
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardLayoutContext } from '@/lib/access/getDashboardLayoutContext'
import { getFullHouseholdForOwner } from '@/lib/household/getHouseholdForOwner'
import { DashboardOnramp } from '@/components/dashboard/DashboardOnramp'
import { shouldShowOnramp } from '@/lib/dashboard/onrampGate'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { isMinimumViableProfile } from '@/lib/estate/profileGate'
import { fetchSetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import { resolveGuidedOnboardingHref } from '@/lib/dashboard/guidedOnboardingHref'
import { DashboardEmptyState } from './_components/DashboardEmptyState'
import { DashboardBody } from './_dashboard-body'
import DashboardLoading from './loading'

export default async function DashboardPage() {
  const layoutContext = await getDashboardLayoutContext()
  if (!layoutContext) return <DashboardEmptyState />

  const { sessionUser, profile, householdRow } = layoutContext
  if (!householdRow) return <DashboardEmptyState />

  const supabase = await createClient()

  const [household, setupProgress] = await Promise.all([
    getFullHouseholdForOwner(sessionUser.id),
    profile?.role === 'consumer'
      ? fetchSetupProgressCounts(supabase, sessionUser.id)
      : Promise.resolve(null),
  ])

  if (!household) return <DashboardEmptyState />

  if (profile?.role === 'consumer' && setupProgress) {
    const profileComplete = isMinimumViableProfile(household).complete
    const showOnramp = shouldShowOnramp({
      profileComplete,
      hasAssets: setupProgress.assets > 0,
      hasIncome: setupProgress.income > 0,
    })

    if (showOnramp) {
      const guidedHref = resolveGuidedOnboardingHref({
        onboardingPersona: profile.onboarding_persona ?? null,
        wizardCompletedAt: profile.onboarding_wizard_completed_at ?? null,
        progress: setupProgress,
      })

      return (
        <DashboardOnramp
          firstName={displayPersonFirstName(
            profile.full_name ?? household.person1_name,
            'there',
          )}
          guidedHref={guidedHref}
          unlock={{
            profileComplete,
            hasAssets: setupProgress.assets > 0,
            hasIncome: setupProgress.income > 0,
          }}
        />
      )
    }
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardBody
        household={household}
        userId={sessionUser.id}
        userEmail={sessionUser.email ?? ''}
      />
    </Suspense>
  )
}

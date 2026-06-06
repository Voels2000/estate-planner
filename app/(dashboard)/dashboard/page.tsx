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
import { checkHouseholdHasData } from '@/lib/onboarding/checkHouseholdHasData'
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

  const [household, { data: healthScore }, hasAnyHouseholdData] = await Promise.all([
    getFullHouseholdForOwner(sessionUser.id),
    supabase
      .from('estate_health_scores')
      .select('score')
      .eq('household_id', householdRow.id)
      .maybeSingle(),
    checkHouseholdHasData(supabase, sessionUser.id),
  ])

  if (!household) return <DashboardEmptyState />

  if (profile?.role === 'consumer') {
    const showOnramp = shouldShowOnramp({
      wizardCompletedAt: profile.onboarding_wizard_completed_at ?? null,
      foundationScore: healthScore?.score ?? null,
      hasAnyHouseholdData,
    })

    if (showOnramp) {
      const setupProgress = await fetchSetupProgressCounts(supabase, sessionUser.id)
      const guidedHref = resolveGuidedOnboardingHref({
        onboardingPersona: profile.onboarding_persona ?? null,
        wizardCompletedAt: profile.onboarding_wizard_completed_at ?? null,
        progress: setupProgress,
      })

      return (
        <DashboardOnramp
          foundationScore={healthScore?.score ?? 0}
          firstName={displayPersonFirstName(
            profile.full_name ?? household.person1_name,
            'there',
          )}
          guidedHref={guidedHref}
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

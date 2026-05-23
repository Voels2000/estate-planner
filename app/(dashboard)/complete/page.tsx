// ─────────────────────────────────────────
// Menu: Retirement Planning > Lifetime Snapshot
// Route: /complete
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { PlanningProjectionEmptyState } from '@/app/(dashboard)/_components/PlanningProjectionEmptyState'
import {
  PLANNING_MISSING_PROJECTION_ACTIONS_TIER2,
  PLANNING_MISSING_PROJECTION_DESCRIPTION,
  PLANNING_NO_HOUSEHOLD_ACTIONS,
} from '@/lib/planning/planningEmptyState'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import CompleteClient from './_complete-client'

export default async function CompletePage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 2) {
    const { data: householdRow } = await supabase
      .from('households')
      .select('state_primary')
      .eq('owner_id', user.id)
      .single()
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      2,
      'See a year-by-year lifetime snapshot of income, taxes, expenses, and net worth.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Lifetime Snapshot</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Lifetime Snapshot"
          valueProposition={valueProposition}
          householdContext={{
            grossEstate: null,
            statePrimary: householdRow?.state_primary ?? null,
            firstName: null,
          }}
        />
      </div>
    )
  }

  const { household, rows } = await loadProjectionData(supabase, user.id)

  if (!household) {
    return (
      <PlanningProjectionEmptyState
        title="Complete your profile first"
        description="Set up your household before viewing a lifetime year-by-year snapshot."
        actions={[...PLANNING_NO_HOUSEHOLD_ACTIONS]}
      />
    )
  }

  if (!rows?.length) {
    return (
      <PlanningProjectionEmptyState
        title="No projection data yet"
        description={PLANNING_MISSING_PROJECTION_DESCRIPTION}
        actions={[...PLANNING_MISSING_PROJECTION_ACTIONS_TIER2]}
        icon="📈"
      />
    )
  }

  const h = household as {
    person1_name?: string | null
    person2_name?: string | null
    has_spouse?: boolean | null
  }

  return (
    <CompleteClient
      rows={rows}
      person1Name={displayPersonFirstName(h.person1_name, 'Person 1')}
      person2Name={
        h.has_spouse ? displayPersonFirstName(h.person2_name, 'Person 2') : null
      }
      hasSpouse={h.has_spouse ?? false}
    />
  )
}

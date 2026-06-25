// ─────────────────────────────────────────
// Menu: Financial Planning > Scenarios
// Route: /scenarios
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { summarizeScenario } from '@/lib/scenarios/summarizeScenario'
import ScenariosClient from './_scenarios-client'
import { buildScenariosPlanningFields } from '@/lib/profile/profileFieldPromptDefs'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getUserAccess()
  if (!hasFeatureAccess('scenarios', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Scenarios</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('scenarios')}
          moduleName="What-If Scenarios"
          valueProposition="Compare what-if scenarios and state-move income tax side by side."
          householdContext={householdContext}
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  let initialResultA = null
  let hasRealEstate = false
  let hasBusiness = false
  if (household) {
    const [{ rows }, { count: reCount }, { count: bizCount }] = await Promise.all([
      loadProjectionData(supabase, user.id),
      supabase.from('real_estate').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
      supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id),
    ])
    hasRealEstate = (reCount ?? 0) > 0
    hasBusiness = (bizCount ?? 0) > 0
    if (rows.length > 0) {
      initialResultA = summarizeScenario(rows, household.person1_retirement_age ?? 65)
    }
  }

  const scenariosPlanningFields = household ? buildScenariosPlanningFields(household) : []

  return (
    <ScenariosClient
      initialHousehold={household}
      initialResultA={initialResultA}
      hasRealEstate={hasRealEstate}
      hasBusiness={hasBusiness}
      scenariosPlanningFields={scenariosPlanningFields}
      householdId={household?.id ?? null}
    />
  )
}

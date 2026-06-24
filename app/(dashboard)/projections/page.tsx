/**
 * Consumer projections page — server-prefetched data.
 * Route: `/projections`
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { mapProjectionRows } from '@/lib/projections/mappers/mapProjectionRows'
import type { HouseholdProjectionProfile } from '@/lib/projections/types'
import { checkProjectionReadiness } from '@/lib/planning/projectionReadiness'
import { loadScenarioMonteCarloWithStaleness } from '@/lib/monte-carlo/loadScenarioMonteCarloWithStaleness'
import { buildProjectionPlanningFields } from '@/lib/profile/profileFieldPromptDefs'
import { WA_REGIME_D, isWaState } from '@/lib/estate/waRegime'
import { ProjectionsClient } from './_projections-client'

export default async function ProjectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getUserAccess()
  if (!hasFeatureAccess('projections', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Projections</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('projections')}
          moduleName="Forward Projections"
          valueProposition="See where your finances are headed with a clear forward projection and what-if modeling."
          householdContext={householdContext}
        />
      </div>
    )
  }

  const projectionLoad = await loadProjectionData(supabase, user.id)

  if (projectionLoad.isStale && projectionLoad.householdId) {
    const { triggerBackgroundBaseCaseAndRecompute } = await import(
      '@/lib/projections/triggerBackgroundBaseCase'
    )
    triggerBackgroundBaseCaseAndRecompute(projectionLoad.householdId)
  }

  const { household, rows } = projectionLoad

  const [
    { count: reCount },
    { count: bizCount },
    { data: assetRows },
    { data: incomeRows },
  ] = await Promise.all([
    supabase.from('real_estate').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('assets').select('value').eq('owner_id', user.id),
    supabase.from('income').select('amount').eq('owner_id', user.id),
  ])

  const householdMcRes = await supabase
    .from('households')
    .select('id, base_case_scenario_id')
    .eq('owner_id', user.id)
    .single()

  const mcLoad =
    householdMcRes.data?.base_case_scenario_id && householdMcRes.data?.id
      ? await loadScenarioMonteCarloWithStaleness(supabase, {
          householdId: householdMcRes.data.id,
          scenarioId: householdMcRes.data.base_case_scenario_id,
        })
      : { summary: null, isStale: false, isUpdating: false }
  const mcData = mcLoad.summary

  const householdProfile = household as HouseholdProjectionProfile | null
  const statePrimary = householdProfile?.state_primary?.trim().toUpperCase() ?? ''
  let stateExemption: number | null = null
  if (statePrimary) {
    const currentYear = new Date().getFullYear()
    let rulesRes = await supabase
      .from('state_estate_tax_rules')
      .select('exemption_amount')
      .eq('state', statePrimary)
      .eq('tax_year', currentYear)
      .order('min_amount', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!rulesRes.data?.exemption_amount) {
      rulesRes = await supabase
        .from('state_estate_tax_rules')
        .select('exemption_amount')
        .eq('state', statePrimary)
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true })
        .limit(1)
        .maybeSingle()
    }
    stateExemption =
      rulesRes.data?.exemption_amount != null ? Number(rulesRes.data.exemption_amount) : null
    if (isWaState(statePrimary)) {
      stateExemption = WA_REGIME_D.exemption
    }
  }

  const totalAssets = (assetRows ?? []).reduce((sum, row) => sum + Number(row.value ?? 0), 0)
  const totalIncome = (incomeRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  const readiness = checkProjectionReadiness({
    person1BirthYear: householdProfile?.person1_birth_year ?? null,
    person1RetirementAge: householdProfile?.person1_retirement_age ?? null,
    totalIncome,
    totalAssets,
  })

  const projectionPlanningFields = householdProfile
    ? buildProjectionPlanningFields(householdProfile)
    : []

  const projections = householdProfile ? mapProjectionRows(rows, householdProfile) : []

  return (
    <ProjectionsClient
      initialHousehold={householdProfile ?? null}
      initialProjections={projections}
      readiness={readiness}
      projectionPlanningFields={projectionPlanningFields}
      householdId={householdProfile?.id ?? null}
      hasRealEstate={(reCount ?? 0) > 0}
      hasBusiness={(bizCount ?? 0) > 0}
      mcBands={mcData?.percentiles_by_year ?? null}
      mcUpdating={mcLoad.isUpdating}
      stateExemption={stateExemption}
    />
  )
}

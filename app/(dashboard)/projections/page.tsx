/**
 * Consumer projections page — server-prefetched data.
 * Route: `/projections`
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { mapProjectionRows } from '@/lib/projections/mappers/mapProjectionRows'
import type { HouseholdProjectionProfile } from '@/lib/projections/types'
import { checkProjectionReadiness } from '@/lib/planning/projectionReadiness'
import { loadScenarioMonteCarlo } from '@/lib/advisor/loadScenarioMonteCarlo'
import { buildProjectionPlanningFields } from '@/lib/profile/profileFieldPromptDefs'
import { ProjectionsClient } from './_projections-client'

export default async function ProjectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectionLoad = await loadProjectionData(supabase, user.id)

  if (projectionLoad.isStale && projectionLoad.householdId) {
    void (async () => {
      try {
        const { generateBaseCase } = await import('@/lib/actions/generate-base-case')
        await generateBaseCase(projectionLoad.householdId!)
      } catch (e) {
        console.error('[projections] background base case regeneration failed', e)
      }
    })()
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
    .select('base_case_scenario_id')
    .eq('owner_id', user.id)
    .single()

  const mcData = householdMcRes.data?.base_case_scenario_id
    ? await loadScenarioMonteCarlo(householdMcRes.data.base_case_scenario_id, supabase)
    : null

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
      stateExemption={stateExemption}
    />
  )
}

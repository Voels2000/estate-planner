import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MyEstateStrategyClient from './_my-estate-strategy-client'

export default async function MyEstateStrategyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: household } = await supabase
    .from('households')
    .select('id, person1_first_name, person1_last_name, base_case_scenario_id')
    .eq('owner_id', user.id)
    .single()

  if (!household) redirect('/profile')

  const { data: scenario } = household.base_case_scenario_id
    ? await admin
        .from('projection_scenarios')
        .select('outputs_s1_first, assumption_snapshot, calculated_at, label')
        .eq('id', household.base_case_scenario_id)
        .single()
    : { data: null }

  const { data: taxConfig } = await admin
    .from('federal_tax_config')
    .select(
      'estate_exemption_individual, estate_exemption_married, estate_top_rate_pct, scenario_id, label'
    )
    .eq('scenario_id', 'current_law_extended')
    .single()

  return (
    <MyEstateStrategyClient
      householdId={household.id}
      scenarioId={household.base_case_scenario_id}
      scenario={scenario}
      taxConfig={taxConfig}
    />
  )
}

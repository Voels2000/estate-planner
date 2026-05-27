// ─────────────────────────────────────────
// Menu: Financial Planning > Scenarios
// Route: /scenarios
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { summarizeScenario } from '@/lib/scenarios/summarizeScenario'
import ScenariosClient from './_scenarios-client'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  return (
    <ScenariosClient
      initialHousehold={household}
      initialResultA={initialResultA}
      hasRealEstate={hasRealEstate}
      hasBusiness={hasBusiness}
    />
  )
}

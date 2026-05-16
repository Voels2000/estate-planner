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
  if (household) {
    const { rows } = await loadProjectionData(supabase, user.id)
    if (rows.length > 0) {
      initialResultA = summarizeScenario(rows, household.person1_retirement_age ?? 65)
    }
  }

  return <ScenariosClient initialHousehold={household} initialResultA={initialResultA} />
}

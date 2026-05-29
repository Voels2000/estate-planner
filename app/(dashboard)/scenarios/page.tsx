// ─────────────────────────────────────────
// Menu: Financial Planning > Scenarios
// Route: /scenarios
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { summarizeScenario } from '@/lib/scenarios/summarizeScenario'
import ScenariosClient from './_scenarios-client'
import { ProfileInlinePromptSection } from '@/components/profile/ProfileInlinePromptSection'
import { buildProfileInlinePayload } from '@/lib/profile/buildProfileInlinePayload'
import { scenariosInlineFields } from '@/lib/profile/profileInlinePrompts'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

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
    <>
      {household && (
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <ProfileInlinePromptSection
            title="Complete planning assumptions"
            description="Retirement age and longevity feed your lifetime projections. Add them here when you're ready to refine scenarios."
            fields={scenariosInlineFields(household)}
            basePayload={buildProfileInlinePayload(household, profile ?? {})}
          />
        </div>
      )}
      <ScenariosClient
      initialHousehold={household}
      initialResultA={initialResultA}
      hasRealEstate={hasRealEstate}
      hasBusiness={hasBusiness}
    />
    </>
  )
}

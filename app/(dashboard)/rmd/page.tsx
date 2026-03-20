import { getUserAccess } from '@/lib/get-user-access'
import { GatedPage } from '@/components/gated-page'
import { createClient } from '@/lib/supabase/server'
import { RmdClient } from './_rmd-client'

export default async function RmdPage() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return (
      <GatedPage requiredTier={2} currentTier={access.tier} featureName="RMD Calculator">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">RMD Calculator</h1>
        </div>
      </GatedPage>
    )
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: household }, { data: assets }] = await Promise.all([
    supabase.from('households')
      .select('id, person1_name, person1_birth_year, person1_longevity_age, person1_retirement_age, has_spouse, person2_name, person2_birth_year, person2_longevity_age, person2_retirement_age, filing_status, growth_rate_retirement')
      .eq('owner_id', user.id)
      .single(),
    supabase.from('assets')
      .select('id, name, type, value, owner')
      .eq('owner_id', user.id)
      .in('type', ['traditional_ira', 'traditional_401k']),
  ])

  return (
    <RmdClient
      household={household}
      assets={assets ?? []}
    />
  )
}

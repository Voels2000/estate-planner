// ─────────────────────────────────────────
// Menu: Retirement Planning > RMD Calculator
// Route: /rmd
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { RmdClient } from './_rmd-client'

export default async function RmdPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 2) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      2,
      'Plan required minimum distributions and minimize tax drag on retirement accounts.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">RMD Planner</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="RMD Planner"
          valueProposition={valueProposition}
          householdContext={householdContext}
        />
      </div>
    )
  }

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

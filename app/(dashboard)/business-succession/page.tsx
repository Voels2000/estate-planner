import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import BusinessSuccessionClient from './_business-succession-client'

export default async function BusinessSuccessionPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (!hasFeatureAccess('business-succession', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      featureUpgradeTier('business-succession'),
      'Document business succession and continuity planning alongside your estate plan.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Business Succession</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('business-succession')}
          moduleName="Business Succession"
          valueProposition={valueProposition}
          householdContext={householdContext}
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select(
      'id, succession_plan_in_place, succession_key_person_identified, succession_buy_sell_in_place',
    )
    .eq('owner_id', user.id)
    .single()

  if (!household) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Complete your profile first</h2>
          <p className="mt-2 text-sm text-amber-700">
            Set up your household on the Profile page before documenting succession planning.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <BusinessSuccessionClient
        initial={{
          succession_plan_in_place: household.succession_plan_in_place,
          succession_key_person_identified: household.succession_key_person_identified,
          succession_buy_sell_in_place: household.succession_buy_sell_in_place,
        }}
      />
    </div>
  )
}

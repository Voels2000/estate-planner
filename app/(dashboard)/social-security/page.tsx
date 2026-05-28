// ─────────────────────────────────────────
// Menu: Retirement Planning > Social Security
// Route: /social-security
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { SSClient } from './_ss-client'
import { loadSocialSecurityData } from '@/lib/social-security/loadSocialSecurityData'

export default async function SocialSecurityPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!hasFeatureAccess('social-security', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      featureUpgradeTier('social-security'),
      'Model break-even claiming ages and spousal coordination scenarios.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Social Security</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('social-security')}
          moduleName="Social Security"
          valueProposition={valueProposition}
          householdContext={householdContext}
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) redirect('/profile')

  const ssData = await loadSocialSecurityData(supabase, user.id)

  return (
    <div className='max-w-7xl mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Social Security</h1>
        <p className='text-sm text-neutral-500 mt-1'>
          Break-even claiming analysis and spousal coordination scenarios
        </p>
      </div>
      <SSClient data={ssData} />
    </div>
  )
}

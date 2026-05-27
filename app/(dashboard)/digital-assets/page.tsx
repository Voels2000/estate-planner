// ─────────────────────────────────────────
// Menu: Financial Planning > Digital Assets
// Route: /digital-assets
// ─────────────────────────────────────────

// Sprint 63 - Consumer digital asset inventory page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import DigitalAssetsClient from './_digital-assets-client'

export default async function DigitalAssetsPage() {
  const access = await getUserAccess()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  if (access.tier < 2 && !access.isAdvisor) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      2,
      'Catalogue digital assets so your executor can locate accounts and platforms.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Digital Assets</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Digital Assets"
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

  if (!household) redirect('/onboarding')

  const { data: assets } = await supabase
    .from('digital_assets')
    .select('*')
    .eq('household_id', household.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <DisclaimerBanner />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Digital Assets</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Catalogue your digital assets so your executor and beneficiaries can locate and manage
            them. Credentials are never required - the key details to act on your behalf.
          </p>
        </div>

        <DigitalAssetsClient initialAssets={assets ?? []} householdId={household.id} />
      </main>
    </div>
  )
}

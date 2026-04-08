// Sprint 63 - Consumer digital asset inventory page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import DigitalAssetIntakeForm from './_components/DigitalAssetIntakeForm'
import DigitalAssetList from './_components/DigitalAssetList'

export default async function DigitalAssetsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

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
          <h1 className="text-2xl font-bold text-gray-900">Digital Asset Inventory</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Catalogue your digital assets so your executor and beneficiaries can locate and manage
            them. Credentials are never required - just enough information to act on your behalf.
          </p>
        </div>

        <DigitalAssetList assets={assets ?? []} householdId={household.id} />
        <DigitalAssetIntakeForm householdId={household.id} />
      </main>
    </div>
  )
}

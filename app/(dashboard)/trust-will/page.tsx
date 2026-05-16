import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import TrustWillClient, { type TrustRow } from './_trust-will-client'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import {
  getTrustWillChecklist,
  getTrustWillRecommendations,
} from '@/lib/trust-will-rules'
import { buildTrustWillProfile } from '@/lib/trusts/trustWillProfile'

export default async function TrustWillPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Trust & Will Guidance</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Trust & Will Guidance"
          valueProposition="Personalized trust and will recommendations based on your estate profile."
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, has_spouse')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household?.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  const [
    composition,
    { data: trusts },
    { data: domicile },
    { data: householdPeople },
    { data: businesses },
  ] = await Promise.all([
    classifyEstateAssets(supabase, household.id),
    supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('domicile_analysis')
      .select('risk_level')
      .eq('household_id', household.id)
      .maybeSingle(),
    supabase
      .from('household_people')
      .select('date_of_birth, relationship')
      .eq('household_id', household.id),
    supabase.from('businesses').select('id').eq('owner_id', user.id).limit(1),
  ])

  const profile = buildTrustWillProfile({
    grossEstate: composition.gross_estate ?? composition.inside_total ?? 0,
    hasSpouse: household.has_spouse === true || composition.has_spouse,
    hasExistingTrust: (trusts?.length ?? 0) > 0,
    hasBusinessInterests:
      (composition.inside_business_taxable ?? 0) > 0 || (businesses?.length ?? 0) > 0,
    domicileRiskLevel: domicile?.risk_level ?? null,
    householdPeople: householdPeople ?? [],
  })

  const recommendations = getTrustWillRecommendations(profile)
  const checklist = getTrustWillChecklist(profile)

  return (
    <TrustWillClient
      estateValue={profile.estateValue}
      recommendations={recommendations}
      checklist={checklist}
      initialTrusts={(trusts as TrustRow[]) ?? []}
    />
  )
}

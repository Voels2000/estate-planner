import { redirect } from 'next/navigation'
import { computeBusinessOwnershipValue } from '@/lib/my-estate-strategy/horizonSnapshots'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import {
  getTrustWillRecommendations,
  getTrustWillChecklist,
  type ProfileData,
} from '@/lib/trust-will-rules'
import TrustWillClient from './_trust-will-client'

export default async function TrustWillPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Trust & Will</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Trust & Will"
          valueProposition="Review your trust and will structure against your current estate complexity."
        />
      </div>
    )
  }

  const admin = createAdminClient()

  // Gross estate — same components as dashboard / My Estate Strategy (see horizonSnapshots + dashboard page)
  const [
    { data: assets },
    { data: realEstate },
    { data: businesses },
    { data: businessInterests },
    { data: insurance },
    { data: profile },
    { data: beneficiaries },
  ] = await Promise.all([
    admin.from('assets').select('value').eq('owner_id', user.id),
    admin.from('real_estate').select('current_value, mortgage_balance').eq('owner_id', user.id),
    admin.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', user.id),
    admin
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', user.id),
    admin.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', user.id),
    admin.from('profiles').select('marital_status, is_admin').eq('id', user.id).single(),
    admin.from('beneficiaries').select('date_of_birth').eq('owner_id', user.id),
  ])

  const financialAssets = (assets ?? []).reduce((s, a) => s + Number(a.value ?? 0), 0)
  const realEstateEquity = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value ?? 0) - Number(r.mortgage_balance ?? 0),
    0,
  )
  const businessValue = computeBusinessOwnershipValue(businesses ?? [], businessInterests ?? [])
  const insuranceValue = (insurance ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)
  const estateValue = financialAssets + realEstateEquity + businessValue + insuranceValue

  const now = new Date()
  const hasMinorChildren = (beneficiaries ?? []).some((b) => {
    if (!b.date_of_birth) return false
    const age = now.getFullYear() - new Date(b.date_of_birth).getFullYear()
    return age < 18
  })

  // Fetch domicile risk from domicile_analyses if available
  const { data: domicile } = await admin
    .from('domicile_analyses')
    .select('risk_score')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const riskScore = domicile?.risk_score ?? 0
  const domicileRisk =
    riskScore >= 71 ? 'critical' :
    riskScore >= 46 ? 'high' :
    riskScore >= 21 ? 'moderate' : 'low'

  // Check for existing trust in titling
  const { data: titling } = await admin
    .from('asset_titling')
    .select('title_type')
    .eq('owner_id', user.id)

  const hasExistingTrust = (titling ?? []).some((t) =>
    t.title_type?.toLowerCase().includes('trust')
  )

  // Check for business assets
  const { data: businessAssets } = await admin
    .from('assets')
    .select('type')
    .eq('owner_id', user.id)
    .ilike('type', '%business%')

  const hasBusinessInterests = (businessAssets ?? []).length > 0

  const profileData: ProfileData = {
    estateValue,
    isMarried: profile?.marital_status === 'married',
    hasMinorChildren,
    domicileRisk,
    hasExistingTrust,
    hasBusinessInterests,
  }

  const recommendations = getTrustWillRecommendations(profileData)
  const checklist = getTrustWillChecklist(profileData)

  return (
    <TrustWillClient
      estateValue={estateValue}
      recommendations={recommendations}
      checklist={checklist}
    />
  )
}

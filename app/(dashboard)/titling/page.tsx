// ─────────────────────────────────────────
// Menu: Estate Planning > Titling & Beneficiaries
// Route: /titling
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import TitlingClient from './_titling-client'

// Exclude P&C lines — same as app/(dashboard)/insurance/page.tsx
const PC_INSURANCE_TYPES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

export default async function TitlingPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!hasFeatureAccess('titling', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    const { getEventUpgradeValueProp } = await import('@/lib/events/upgradeContext')
    const valueProposition = await getEventUpgradeValueProp(
      supabase,
      user.id,
      featureUpgradeTier('titling'),
      'Review and optimize how assets are titled to avoid probate and tax exposure.',
    )
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Titling & Beneficiaries</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('titling')}
          moduleName="Titling & Beneficiaries"
          valueProposition={valueProposition}
          householdContext={householdContext}
        />
      </div>
    )
  }

  const [
    { data: titlingCategories },
    { data: household },
    { data: assets },
    { data: realEstate },
    { data: assetTitling },
    { data: realEstateTitling },
    { data: beneficiaries },
    { data: insurance },
    { data: businesses },
    { data: insurancePolicyTitling },
    { data: businessTitling },
    { data: householdPeople },
  ] = await Promise.all([
    supabase
      .from('titling_asset_categories')
      .select('value, label, icon, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('households')
      .select('id, person1_name, person2_name, has_spouse')
      .eq('owner_id', user.id)
      .maybeSingle(),
    supabase
      .from('assets')
      .select('id, name, type, value, owner, cost_basis, basis_date, titling, liquidity')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('real_estate')
      .select('id, name, property_type, current_value, owner, titling, liquidity, cost_basis, basis_date')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('asset_titling')
      .select('id, asset_id, title_type, notes')
      .eq('owner_id', user.id),
    supabase
      .from('real_estate_titling')
      .select('id, real_estate_id, title_type, notes')
      .eq('owner_id', user.id),
    supabase
      .from('asset_beneficiaries')
      .select('id, asset_id, real_estate_id, insurance_policy_id, business_id, beneficiary_type, full_name, relationship, email, phone, allocation_pct, is_gst_skip')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('insurance_policies')
      .select('id, policy_name, insurance_type, death_benefit, owner, titling, liquidity, cost_basis, basis_date')
      .eq('user_id', user.id)
      .not('insurance_type', 'in', `(${PC_INSURANCE_TYPES.join(',')})`)
      .order('created_at', { ascending: false }),
    supabase
      .from('businesses')
      .select('id, name, estimated_value, entity_type, owner, titling, liquidity, cost_basis, basis_date')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('insurance_policy_titling')
      .select('id, insurance_policy_id, title_type, notes')
      .eq('owner_id', user.id),
    supabase
      .from('business_titling')
      .select('id, business_id, title_type, notes')
      .eq('owner_id', user.id),
    supabase
      .from('household_people')
      .select('id, full_name, relationship, date_of_birth, is_gst_skip, households!inner(owner_id)')
      .eq('households.owner_id', user.id)
      .order('full_name', { ascending: true }),
  ])

  return (
    <TitlingClient
      categories={titlingCategories ?? []}
      householdId={household?.id ?? null}
      initialAssets={assets ?? []}
      initialRealEstate={realEstate ?? []}
      initialAssetTitling={assetTitling ?? []}
      initialRealEstateTitling={realEstateTitling ?? []}
      initialBeneficiaries={beneficiaries ?? []}
      initialInsurance={insurance ?? []}
      initialBusinesses={businesses ?? []}
      initialInsurancePolicyTitling={insurancePolicyTitling ?? []}
      initialBusinessTitling={businessTitling ?? []}
      householdPeople={householdPeople ?? []}
      hasSpouse={household?.has_spouse === true}
      person1LegalName={household?.person1_name?.trim() ?? null}
      person2LegalName={household?.person2_name?.trim() ?? null}
    />
  )
}

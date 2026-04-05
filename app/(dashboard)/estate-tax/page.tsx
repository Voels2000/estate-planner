import { getUserAccess } from '@/lib/get-user-access'
import EstatePlanningDashboard from '@/components/EstatePlanningDashboard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import EstateTaxClient, { type EstateTaxTrustRow } from './_estate-tax-client'

export default async function EstateTaxPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Estate Tax Planner</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Estate Tax Planner"
          valueProposition="Calculate federal and state estate tax exposure and model reduction strategies."
        />
      </div>
    )
  }

  const [
    { data: realEstateRows },
    { data: assetsRows },
    { data: liabilitiesRows },
    { data: trustsRows },
    { data: householdRow },
    { data: federalEstateTaxBracketsRows },
    { data: stateEstateTaxRows },
    { data: stateInheritanceTaxRows },
  ] = await Promise.all([
    supabase
      .from('real_estate')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('assets')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('liabilities')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('trusts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('households').select('*').eq('owner_id', user.id).maybeSingle(),
    // Fetch all years — client filters to most recent
    supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true }),
    // Fetch all years — client filters to most recent
    supabase
      .from('state_estate_tax_rules')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true })
      .order('min_amount', { ascending: true }),
    // Fetch all years — client filters to most recent
    supabase
      .from('state_inheritance_tax_rules')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true }),
  ])

  return (
    <>
      {householdRow?.id && (
        <EstatePlanningDashboard
          householdId={householdRow.id as string}
          userRole={access.isAdvisor ? 'advisor' : 'consumer'}
          consumerTier={access.tier}
        />
      )}
      <EstateTaxClient
        realEstate={realEstateRows ?? []}
        assets={assetsRows ?? []}
        liabilities={liabilitiesRows ?? []}
        trusts={(trustsRows ?? []) as EstateTaxTrustRow[]}
        household={householdRow as Record<string, unknown> | null}
        brackets={federalEstateTaxBracketsRows ?? []}
        stateEstateTaxRules={stateEstateTaxRows ?? []}
        stateInheritanceTaxRules={stateInheritanceTaxRows ?? []}
      />
    </>
  )
}

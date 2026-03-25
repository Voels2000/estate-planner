import { getUserAccess } from '@/lib/get-user-access'
import { GatedPage } from '@/components/gated-page'
import EstatePlanningDashboard from '@/components/EstatePlanningDashboard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstateTaxClient, { type EstateTaxTrustRow } from './_estate-tax-client'

export default async function EstateTaxPage() {
  const access = await getUserAccess()
  if (access.tier < 3) {
    return (
      <GatedPage requiredTier={3} currentTier={access.tier} featureName="Estate Tax Planning">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">Estate Tax Planning</h1>
        </div>
      </GatedPage>
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

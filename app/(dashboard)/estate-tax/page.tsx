import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstateTaxClient, { type EstateTaxTrustRow } from './_estate-tax-client'

export default async function EstateTaxPage() {
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
    supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .order('min_amount', { ascending: true }),
    supabase
      .from('state_estate_tax_rules')
      .select('*')
      .eq('tax_year', 2024)
      .order('state', { ascending: true })
      .order('min_amount', { ascending: true }),
    supabase
      .from('state_inheritance_tax_rules')
      .select('*')
      .eq('tax_year', 2024)
      .order('state', { ascending: true }),
  ])

  return (
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
  )
}

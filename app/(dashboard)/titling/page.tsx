import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TitlingClient from './_titling-client'

export default async function TitlingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: titlingCategories },
    { data: household },
    { data: assets },
    { data: realEstate },
    { data: assetTitling },
    { data: realEstateTitling },
    { data: beneficiaries },
  ] = await Promise.all([
    supabase
      .from('titling_asset_categories')
      .select('value, label, icon, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('households')
      .select('person1_name, person2_name, has_spouse')
      .eq('owner_id', user.id)
      .single(),
    supabase
      .from('assets')
      .select('id, name, type, value, owner')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('real_estate')
      .select('id, name, property_type, current_value, owner')
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
      .select('id, asset_id, real_estate_id, beneficiary_type, full_name, relationship, email, phone, allocation_pct')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <TitlingClient
      categories={titlingCategories ?? []}
      initialAssets={assets ?? []}
      initialRealEstate={realEstate ?? []}
      initialAssetTitling={assetTitling ?? []}
      initialRealEstateTitling={realEstateTitling ?? []}
      initialBeneficiaries={beneficiaries ?? []}
      person1Name={household?.person1_name ?? 'Person 1'}
      person2Name={household?.person2_name ?? 'Person 2'}
    />
  )
}

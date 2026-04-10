import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReferenceDataClient from './_reference-data-client'

export default async function ReferenceDataPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin, is_superuser')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_superuser) redirect('/dashboard')

  const [
    { data: assetTypes },
    { data: titlingTypes },
    { data: liquidityTypes },
    { data: entityTypes },
    { data: valuationMethods },
    { data: successionPlans },
  ] = await Promise.all([
    supabase.from('asset_types').select('*').order('sort_order'),
    supabase.from('ref_titling_types').select('*').order('sort_order'),
    supabase.from('ref_liquidity_types').select('*').order('sort_order'),
    supabase.from('business_entity_types').select('*').order('sort_order'),
    supabase.from('ref_valuation_methods').select('*').order('sort_order'),
    supabase.from('ref_succession_plans').select('*').order('sort_order'),
  ])

  return (
    <ReferenceDataClient
      tables={{
        'Asset Types': { tableName: 'asset_types', rows: assetTypes ?? [] },
        'Titling Types': { tableName: 'ref_titling_types', rows: titlingTypes ?? [] },
        'Liquidity Types': { tableName: 'ref_liquidity_types', rows: liquidityTypes ?? [] },
        'Business Entity Types': { tableName: 'business_entity_types', rows: entityTypes ?? [] },
        'Valuation Methods': { tableName: 'ref_valuation_methods', rows: valuationMethods ?? [] },
        'Succession Plans': { tableName: 'ref_succession_plans', rows: successionPlans ?? [] },
      }}
    />
  )
}

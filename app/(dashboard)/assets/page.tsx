// ─────────────────────────────────────────
// Menu: Financial Planning > Assets
// Route: /assets
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { AssetsClient } from './_assets-client'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: assets },
    { data: assetTypes },
    { data: liquidityTypes },
    { data: titlingTypes },
    { data: household },
  ] = await Promise.all([
    supabase.from('assets').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('asset_types').select('value, label').eq('is_active', true).order('sort_order'),
    supabase.from('ref_liquidity_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('ref_titling_types').select('value, label, description').eq('is_active', true).order('sort_order'),
    supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
  ])

  return (
    <AssetsClient
      initialAssets={assets ?? []}
      assetTypes={assetTypes ?? []}
      liquidityTypes={liquidityTypes ?? []}
      titlingTypes={titlingTypes ?? []}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={displayPersonFirstName(household?.person2_name, 'Person 2')}
    />
  )
}

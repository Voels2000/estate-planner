// ─────────────────────────────────────────
// Menu: Financial Planning > Liabilities
// Route: /liabilities
// ─────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { LiabilitiesClient } from './_liabilities-client'

export default async function LiabilitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: liabilities },
    { data: liabilityTypes },
    { data: household },
  ] = await Promise.all([
    supabase.from('liabilities').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('liability_types').select('value, label').order('sort_order'),
    supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
  ])

  return (
    <LiabilitiesClient
      initialLiabilities={liabilities ?? []}
      liabilityTypes={liabilityTypes ?? []}
      person1Name={displayPersonFirstName(household?.person1_name, 'Person 1')}
      person2Name={displayPersonFirstName(household?.person2_name, 'Person 2')}
    />
  )
}

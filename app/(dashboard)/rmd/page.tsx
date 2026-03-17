import { createClient } from '@/lib/supabase/server'
import { RmdClient } from './_rmd-client'

export default async function RmdPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: household },
    { data: assets },
  ] = await Promise.all([
    supabase.from('households')
      .select('id, person1_birth_year, person1_longevity_age, person1_retirement_age, has_spouse, person2_birth_year, filing_status, growth_rate_retirement')
      .eq('owner_id', user.id)
      .single(),
    supabase.from('assets')
      .select('id, name, type, value')
      .eq('owner_id', user.id)
      .in('type', ['traditional_ira', 'traditional_401k']),
  ])

  return (
    <RmdClient
      household={household}
      assets={assets ?? []}
    />
  )
}

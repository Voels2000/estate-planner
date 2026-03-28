import { createClient } from '@/lib/supabase/server'
import { AdvisorDirectoryClient } from './_advisor-directory-client'

export default async function AdvisorDirectoryPage() {
  const supabase = await createClient()

  const { data: advisors } = await supabase
    .from('advisor_directory')
    .select('*')
    .eq('is_active', true)
    .order('is_verified', { ascending: false })
    .order('firm_name')

  // Build filter options from data
  const allSpecializations = Array.from(
    new Set((advisors ?? []).flatMap(a => a.specializations ?? []))
  ).sort()

  const allCredentials = Array.from(
    new Set((advisors ?? []).flatMap(a => a.credentials ?? []))
  ).sort()

  const allStates = Array.from(
    new Set((advisors ?? []).map(a => a.state).filter(Boolean))
  ).sort()

  return (
    <AdvisorDirectoryClient
      advisors={advisors ?? []}
      allSpecializations={allSpecializations}
      allCredentials={allCredentials}
      allStates={allStates}
    />
  )
}

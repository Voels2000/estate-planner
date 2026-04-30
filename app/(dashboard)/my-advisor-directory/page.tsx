import { createClient } from '@/lib/supabase/server'
import { AdvisorDirectoryClient } from './_advisor-directory-client'

export default async function AdvisorDirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: connectionRows } = user
    ? await supabase
      .from('connection_requests')
      .select('listing_id')
      .eq('consumer_id', user.id)
      .eq('listing_type', 'advisor')
      .eq('status', 'pending')
    : { data: null }

const existingConnections = (connectionRows ?? []).map(r => r.listing_id)

  const { data: advisors } = await supabase
    .from('advisor_directory')
    .select('*, profile_id')
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
      existingConnections={existingConnections}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { AttorneyDirectoryClient } from './_attorney-directory-client'

export default async function PublicAttorneyDirectoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: connectionRows } = user
    ? await supabase
        .from('connection_requests')
        .select('listing_id')
        .eq('consumer_id', user.id)
        .eq('listing_type', 'attorney')
        .eq('status', 'pending')
    : { data: null }

  const existingConnections = (connectionRows ?? []).map(r => r.listing_id)

  const { data: attorneys } = await supabase
    .from('attorney_listings')
    .select('*')
    .eq('is_active', true)
    .eq('is_verified', true)
    .order('is_verified', { ascending: false })
    .order('firm_name')

  const allSpecializations = Array.from(
    new Set((attorneys ?? []).flatMap(a => a.specializations ?? []))
  ).sort()

  const allStatesLicensed = Array.from(
    new Set((attorneys ?? []).flatMap(a => a.states_licensed ?? []))
  ).sort()

  const allStates = Array.from(
    new Set((attorneys ?? []).map(a => a.state).filter(Boolean))
  ).sort()

  return (
    <AttorneyDirectoryClient
      attorneys={attorneys ?? []}
      allSpecializations={allSpecializations}
      allStatesLicensed={allStatesLicensed}
      allStates={allStates}
      existingConnections={existingConnections}
      isLoggedIn={!!user}
    />
  )
}

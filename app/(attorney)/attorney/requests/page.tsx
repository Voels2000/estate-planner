import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyRequestsClient } from './_attorney-requests-client'

export default async function AttorneyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string }>
}) {
  const supabase = await createClient()
  const { claimed } = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id, firm_name')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!listing) {
    return (
      <AttorneyRequestsClient
        incomingRequests={[]}
        intakeRequests={[]}
        showClaimedBanner={claimed === 'true'}
        hasListing={false}
      />
    )
  }

  const { data: incomingRows } = await supabase
    .from('attorney_clients')
    .select('id, client_id, request_message, created_at')
    .eq('attorney_id', listing.id)
    .eq('status', 'consumer_requested')
    .order('created_at', { ascending: false })

  const householdIds = (incomingRows ?? []).map((r) => r.client_id).filter(Boolean)
  const { data: households } =
    householdIds.length > 0
      ? await supabase
          .from('households')
          .select('id, owner_id, state_primary')
          .in('id', householdIds)
      : { data: [] }

  const ownerIds = (households ?? []).map((h) => h.owner_id).filter(Boolean)
  const { data: owners } =
    ownerIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds)
      : { data: [] }

  const incomingRequests = (incomingRows ?? []).map((row) => {
    const household = (households ?? []).find((h) => h.id === row.client_id)
    const owner = (owners ?? []).find((p) => p.id === household?.owner_id)
    return {
      id: row.id,
      household_id: row.client_id,
      request_message: row.request_message,
      created_at: row.created_at,
      full_name: owner?.full_name ?? 'Prospective client',
      email: owner?.email ?? '',
      state: household?.state_primary ?? '',
    }
  })

  const { data: intakeRows } = await supabase
    .from('attorney_intake_requests')
    .select('id, client_email, client_name, status, sent_at')
    .eq('listing_id', listing.id)
    .in('status', ['sent', 'opened'])
    .order('sent_at', { ascending: false })

  return (
    <AttorneyRequestsClient
      incomingRequests={incomingRequests}
      intakeRequests={(intakeRows ?? []).map((r) => ({
        id: r.id,
        client_email: r.client_email,
        client_name: r.client_name,
        displayStatus: r.status as 'sent' | 'opened',
        sent_at: r.sent_at,
      }))}
      showClaimedBanner={claimed === 'true'}
      hasListing={true}
    />
  )
}

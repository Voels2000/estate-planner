import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import MyAttorneyClient from './_my-attorney-client'

export default async function MyAttorneyPage() {
  const { user } = await getAccessContext()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get household (attorney_clients uses household_id as client_id)
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Fetch accepted attorney connections
  const { data: connections } = household
    ? await supabase
        .from('attorney_clients')
        .select(`
          id,
          attorney_id,
          status,
          granted_at,
          advisor_pdf_access
        `)
        .eq('client_id', household.id)
        .in('status', ['active', 'accepted'])
        .order('granted_at', { ascending: false })
    : { data: [] }

  // Fetch attorney listing details for each connection
  const attorneyIds = (connections ?? []).map(c => c.attorney_id).filter(Boolean)
  const { data: listings } = attorneyIds.length > 0
    ? await supabase
        .from('attorney_listings')
        .select('id, firm_name, contact_name, email, city, state, bio, specializations, credentials, website')
        .in('id', attorneyIds)
    : { data: [] }

  // Fetch pending connection requests
  const { data: pendingRequests } = await supabase
    .from('connection_requests')
    .select('id, created_at, listing_id, message, status')
    .eq('consumer_id', user.id)
    .eq('listing_type', 'attorney')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Fetch listing details for pending requests
  const pendingListingIds = (pendingRequests ?? []).map(r => r.listing_id).filter(Boolean)
  const { data: pendingListings } = pendingListingIds.length > 0
    ? await supabase
        .from('attorney_listings')
        .select('id, firm_name, city, state')
        .in('id', pendingListingIds)
    : { data: [] }

  // Shape connections with listing details merged
  const shapedConnections = (connections ?? []).map(conn => {
    const listing = (listings ?? []).find(l => l.id === conn.attorney_id)
    return {
      connection_id: conn.id,
      attorney_id: conn.attorney_id,
      status: conn.status,
      granted_at: conn.granted_at,
      advisor_pdf_access: conn.advisor_pdf_access,
      firm_name: listing?.firm_name ?? null,
      contact_name: listing?.contact_name ?? null,
      email: listing?.email ?? null,
      city: listing?.city ?? null,
      state: listing?.state ?? null,
      bio: listing?.bio ?? null,
      specializations: listing?.specializations ?? [],
      credentials: listing?.credentials ?? [],
      website: listing?.website ?? null,
    }
  })

  // Shape pending requests with listing details
  const shapedPending = (pendingRequests ?? []).map(req => {
    const listing = (pendingListings ?? []).find(l => l.id === req.listing_id)
    return {
      id: req.id,
      created_at: req.created_at,
      listing_id: req.listing_id,
      firm_name: listing?.firm_name ?? null,
      city: listing?.city ?? null,
      state: listing?.state ?? null,
    }
  })

  const { data: docRequests } = household
    ? await supabase
        .from('attorney_document_requests')
        .select(
          'id, document_type, message, requested_at, attorney_listings(firm_name, contact_name)',
        )
        .eq('household_id', household.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
    : { data: [] }

  const shapedDocRequests = (docRequests ?? []).map((r) => {
    const listing = Array.isArray(r.attorney_listings)
      ? r.attorney_listings[0]
      : r.attorney_listings
    return {
      id: r.id as string,
      document_type: r.document_type as string,
      message: (r.message as string | null) ?? null,
      requested_at: r.requested_at as string,
      attorney_listings: listing ?? null,
    }
  })

  return (
    <MyAttorneyClient
      connections={shapedConnections}
      pendingRequests={shapedPending}
      documentRequests={shapedDocRequests}
    />
  )
}

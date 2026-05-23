import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { getAppUrl } from '@/lib/app-url'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import MyAdvisorClient from './_my-advisor-client'

export default async function MyAdvisorPage() {
  const { user, isSuperuser } = await getAccessContext()
  if (!user) redirect('/login')
  if (!isSuperuser) {
    // consumer-only gate: none (nav hides for non-consumers; layout enforces access)
  }

  const supabase = await createClient()

  // Find active advisor connection
  const { data: connection } = await supabase
    .from('advisor_clients')
    .select(`
      id,
      status,
      accepted_at,
      advisor_id,
      profiles!advisor_clients_advisor_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('client_id', user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  // Try to get advisor listing details
  const advisorId = connection?.advisor_id ?? null
  const { data: listing } = advisorId
    ? await supabase
        .from('advisor_directory')
        .select('firm_name, city, state, bio, credentials, specializations, is_fiduciary, website')
        .eq('profile_id', advisorId)
        .maybeSingle()
    : { data: null }

  // Fetch access log — last 5 times advisor viewed their data
  const { data: accessLog } = await supabase
    .from('advisor_access_log')
    .select('accessed_at, page')
    .eq('client_id', user.id)
    .order('accessed_at', { ascending: false })
    .limit(5)

  // Fetch pending connection request (if no accepted connection)
  const { data: pendingRequest } = !connection
    ? await supabase
        .from('connection_requests')
        .select('id, created_at, listing_id, message')
        .eq('consumer_id', user.id)
        .eq('listing_type', 'advisor')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // Fetch listing details for pending request if present
  const { data: pendingListing } = pendingRequest
    ? await supabase
        .from('advisor_directory')
        .select('firm_name, city, state')
        .eq('id', pendingRequest.listing_id)
        .maybeSingle()
    : { data: null }

  const normalizedConnection = connection
    ? {
        ...connection,
        profiles: Array.isArray(connection.profiles)
          ? connection.profiles[0] ?? null
          : connection.profiles,
      }
    : null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const consumerName = profile?.full_name ?? 'Your client'
  const appUrl = getAppUrl()

  const inviteEmailBody = encodeURIComponent(
    `Hi,\n\nI've been using My Wealth Maps to organize my estate and financial plan, and I'd like to invite you to connect so you can view my plan and collaborate with me.\n\nClick here to join: ${appUrl}/signup?role=advisor\n\nOnce you're set up, search for me by email to connect.\n\nThanks,\n${consumerName}`,
  )

  const inviteEmailSubject = encodeURIComponent(
    'Invitation to connect on My Wealth Maps',
  )

  return (
    <MyAdvisorClient
      connection={normalizedConnection}
      listing={listing ?? null}
      accessLog={accessLog ?? []}
      pendingRequest={pendingRequest ? {
        id: pendingRequest.id,
        created_at: pendingRequest.created_at,
        firm_name: pendingListing?.firm_name ?? null,
        city: pendingListing?.city ?? null,
        state: pendingListing?.state ?? null,
      } : null}
      inviteEmailSubject={inviteEmailSubject}
      inviteEmailBody={inviteEmailBody}
      consumerName={consumerName}
    />
  )
}

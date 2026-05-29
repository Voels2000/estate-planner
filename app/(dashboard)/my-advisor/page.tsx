import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { isWizardComplete } from '@/lib/estate/profileGate'
import MyAdvisorClient from './_my-advisor-client'

export default async function MyAdvisorPage() {
  const { user, isSuperuser } = await getAccessContext()
  if (!user) redirect('/login')
  if (!isSuperuser) {
    // consumer-only gate: none (nav hides for non-consumers; layout enforces access)
  }

  const supabase = await createClient()

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

  const advisorId = connection?.advisor_id ?? null
  const { data: listing } = advisorId
    ? await supabase
        .from('advisor_directory')
        .select('firm_name, city, state, bio, credentials, specializations, is_fiduciary, website')
        .eq('profile_id', advisorId)
        .maybeSingle()
    : { data: null }

  const { data: accessLog } = await supabase
    .from('advisor_access_log')
    .select('accessed_at, page')
    .eq('client_id', user.id)
    .order('accessed_at', { ascending: false })
    .limit(5)

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

  const { data: pendingListing } = pendingRequest
    ? await supabase
        .from('advisor_directory')
        .select('firm_name, city, state')
        .eq('id', pendingRequest.listing_id)
        .maybeSingle()
    : { data: null }

  const { data: outboundInvite } = !connection
    ? await supabase
        .from('advisor_clients')
        .select(`
          id,
          invited_email,
          invited_at,
          advisor_id,
          profiles!advisor_clients_advisor_id_fkey (
            full_name,
            email
          )
        `)
        .eq('client_id', user.id)
        .eq('status', 'consumer_requested')
        .order('invited_at', { ascending: false })
        .limit(1)
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
    .select('full_name, onboarding_wizard_completed_at')
    .eq('id', user.id)
    .single()

  const wizardComplete = isWizardComplete(profile)
  const consumerName = profile?.full_name ?? 'Your client'

  const outboundAdvisorProfile = outboundInvite?.profiles
    ? Array.isArray(outboundInvite.profiles)
      ? outboundInvite.profiles[0] ?? null
      : outboundInvite.profiles
    : null

  return (
    <MyAdvisorClient
      connection={normalizedConnection}
      wizardComplete={wizardComplete}
      listing={listing ?? null}
      accessLog={accessLog ?? []}
      pendingRequest={
        pendingRequest
          ? {
              id: pendingRequest.id,
              created_at: pendingRequest.created_at,
              firm_name: pendingListing?.firm_name ?? null,
              city: pendingListing?.city ?? null,
              state: pendingListing?.state ?? null,
            }
          : null
      }
      outboundInvite={
        outboundInvite
          ? {
              id: outboundInvite.id,
              invited_email: outboundInvite.invited_email,
              created_at: outboundInvite.invited_at ?? new Date().toISOString(),
              advisor_name:
                outboundAdvisorProfile?.full_name?.trim() ||
                outboundAdvisorProfile?.email ||
                null,
            }
          : null
      }
      consumerName={consumerName}
    />
  )
}

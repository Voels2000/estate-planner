import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ClaimListingPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Find the connection request by claim token — supports both advisor and attorney
  const { data: connectionRequest } = await admin
    .from('connection_requests')
    .select('id, listing_id, listing_type, consumer_id, message, status')
    .eq('claim_token', token)
    .in('listing_type', ['advisor', 'attorney'])
    .maybeSingle()

  if (!connectionRequest || connectionRequest.status !== 'pending') {
    redirect('/claim-listing/invalid')
  }

  const isAttorney = connectionRequest.listing_type === 'attorney'

  // 2. Fetch the listing from the correct table
  const listingTable = isAttorney ? 'attorney_listings' : 'advisor_directory'
  const { data: listing } = await admin
    .from(listingTable)
    .select('id, firm_name, email, profile_id')
    .eq('id', connectionRequest.listing_id)
    .single()

  if (!listing) redirect('/claim-listing/invalid')

  // 3. Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?claim=${token}&next=/claim-listing/${token}`)
  }

  // 4. Verify the logged-in user has an appropriate role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'advisor' && !profile.is_attorney)) {
    redirect(`/dashboard?error=not-advisor`)
  }

  // 5. If listing is already claimed by someone else — block
  if (listing.profile_id && listing.profile_id !== user.id) {
    redirect('/claim-listing/already-claimed')
  }

  // 6. Claim the listing — link profile_id in the correct table
  if (!listing.profile_id) {
    await admin
      .from(listingTable)
      .update({ profile_id: user.id })
      .eq('id', listing.id)
  }

  // 7. For advisor-type: migrate into advisor_clients as consumer_requested
  //    For attorney-type: the connection_request row itself is the record — no separate clients table yet
  if (!isAttorney) {
    const { data: existingRow } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('advisor_id', user.id)
      .eq('client_id', connectionRequest.consumer_id)
      .neq('status', 'removed')
      .maybeSingle()

    if (!existingRow) {
      await admin.from('advisor_clients').insert({
        advisor_id: user.id,
        client_id: connectionRequest.consumer_id,
        status: 'consumer_requested',
        request_message: connectionRequest.message,
      })
    }
  }

  // 8. Mark connection request as accepted
  await admin
    .from('connection_requests')
    .update({ status: 'accepted', profile_id: user.id })
    .eq('id', connectionRequest.id)

  // 9. Notify consumer that the listing has been claimed and is under review
  ;(async () => {
    try {
      await admin.rpc('create_notification', {
        p_user_id: connectionRequest.consumer_id,
        p_type: 'consumer_connection_request',
        p_title: 'Your request was received',
        p_body: `${profile.full_name ?? listing.firm_name} has received your connection request and will respond shortly.`,
        p_delivery: 'in_app',
        p_metadata: { listing_id: listing.id },
        p_cooldown: '1 hour',
      })
    } catch (err) {
      console.error('claim-listing notification error:', err)
    }
  })()

  // 10. Redirect to the appropriate portal
  redirect(isAttorney ? '/attorney?claimed=true' : '/advisor?claimed=true')
}

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

  // 1. Find the connection request by claim token
  const { data: connectionRequest } = await admin
    .from('connection_requests')
    .select('id, listing_id, listing_type, consumer_id, message, status')
    .eq('claim_token', token)
    .eq('listing_type', 'advisor')
    .maybeSingle()

  if (!connectionRequest || connectionRequest.status !== 'pending') {
    redirect('/claim-listing/invalid')
  }

  // 2. Fetch the listing
  const { data: listing } = await admin
    .from('advisor_directory')
    .select('id, firm_name, email, profile_id')
    .eq('id', connectionRequest.listing_id)
    .single()

  if (!listing) redirect('/claim-listing/invalid')

  // 3. Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in — redirect to login with claim token preserved
    redirect(`/login?claim=${token}&next=/claim-listing/${token}`)
  }

  // 4. Verify the logged in user is an advisor
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

  // 6. Claim the listing — link profile_id
  if (!listing.profile_id) {
    await admin
      .from('advisor_directory')
      .update({ profile_id: user.id })
      .eq('id', listing.id)
  }

  // 7. Migrate this connection request into advisor_clients as consumer_requested
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

  // 8. Mark connection request as accepted
  await admin
    .from('connection_requests')
    .update({ status: 'accepted', profile_id: user.id })
    .eq('id', connectionRequest.id)

  // 9. Notify consumer that advisor has claimed and is reviewing
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

  // 10. Redirect to advisor portal where they can accept/decline
  redirect('/advisor?claimed=true')
}

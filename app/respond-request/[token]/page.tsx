import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAttorneyActivationDripStep1 } from '@/lib/attorney/sendAttorneyDripStep'
import { ensureAttorneyClientRequestRow } from '@/lib/attorney/createAttorneyClientRequest'
import { verifyClaimIdentity } from '@/lib/directory/claimIdentity'

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
    redirect('/respond-request/invalid')
  }

  const isAttorney = connectionRequest.listing_type === 'attorney'

  // 2. Fetch the listing from the correct table
  const listingTable = isAttorney ? 'attorney_listings' : 'advisor_directory'
  const { data: attorneyListing } = isAttorney
    ? await admin
        .from('attorney_listings')
        .select('id, firm_name, email, profile_id, website')
        .eq('id', connectionRequest.listing_id)
        .single()
    : { data: null }
  const { data: advisorListing } = !isAttorney
    ? await admin
        .from('advisor_directory')
        .select('id, firm_name, email, profile_id, website, adv_link')
        .eq('id', connectionRequest.listing_id)
        .single()
    : { data: null }

  const listing = isAttorney ? attorneyListing : advisorListing

  if (!listing) redirect('/respond-request/invalid')

  // 3. Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?claim=${token}&next=/respond-request/${token}`)
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
    redirect('/respond-request/already-claimed')
  }

  // 6. Claim the listing — link profile_id only after identity matches listing email/domain
  if (!listing.profile_id) {
    if (!user.email) {
      redirect('/respond-request/identity-mismatch')
    }
    const listingWebsite = isAttorney
      ? String(listing.website ?? '')
      : String(
          listing.website ??
            ('adv_link' in listing ? listing.adv_link : null) ??
            '',
        )
    const identity = verifyClaimIdentity(user.email, listing.email, listingWebsite)
    if (!identity.ok) {
      redirect('/respond-request/identity-mismatch')
    }

    await admin
      .from(listingTable)
      .update({ profile_id: user.id })
      .eq('id', listing.id)
  }

  // 7. Migrate into clients table as consumer_requested
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
  } else {
    await ensureAttorneyClientRequestRow(admin, {
      attorneyListingId: listing.id,
      consumerUserId: connectionRequest.consumer_id,
      requestMessage: connectionRequest.message,
    })
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
      console.error('respond-request notification error:', err)
    }
  })()

  // 10. Redirect to the appropriate portal
  if (isAttorney) {
    void ensureAttorneyActivationDripStep1(admin, user.id).catch((err) => {
      console.error('attorney drip step 1 (respond-request):', err instanceof Error ? err.message : err)
    })
  }

  redirect(isAttorney ? '/attorney/requests?claimed=true' : '/advisor?claimed=true')
}

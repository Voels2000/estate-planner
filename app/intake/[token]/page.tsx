import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { IntakeLandingClient } from '../_intake-landing-client'

interface Props {
  params: Promise<{ token: string }>
}

export default async function IntakeAcceptPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('attorney_intake_requests')
    .select('id, attorney_id, client_email, client_name, status, expires_at, listing_id')
    .eq('token', token)
    .maybeSingle()

  if (!request) {
    redirect('/intake/invalid')
  }

  if (new Date(request.expires_at) < new Date()) {
    if (request.status !== 'completed') {
      await admin
        .from('attorney_intake_requests')
        .update({ status: 'expired' })
        .eq('id', request.id)
    }
    redirect('/intake/expired')
  }

  if (request.status === 'completed') {
    redirect('/dashboard')
  }

  if (request.status === 'sent') {
    await admin
      .from('attorney_intake_requests')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', request.id)
  }

  const { data: attorney } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', request.attorney_id)
    .single()

  const { data: listing } = request.listing_id
    ? await admin
        .from('attorney_listings')
        .select('firm_name, city, state')
        .eq('id', request.listing_id)
        .single()
    : { data: null }

  const attorneyName = attorney?.full_name ?? listing?.firm_name ?? 'Your attorney'
  const firm = listing
    ? `${listing.firm_name}${listing.city ? `, ${listing.city}` : ''}${listing.state ? ` ${listing.state}` : ''}`
    : null

  return <IntakeLandingClient token={token} attorneyName={attorneyName} firm={firm} />
}

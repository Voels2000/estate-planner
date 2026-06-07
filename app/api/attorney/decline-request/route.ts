import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { NextResponse } from 'next/server'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isAttorney } = await getAccessContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAttorney) {
    return NextResponse.json({ error: 'Attorney access required' }, { status: 403 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const attorneyListingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!attorneyListingId) {
    return NextResponse.json({ error: 'Attorney listing not found' }, { status: 404 })
  }

  const { attorney_client_id } = await request.json()
  if (!attorney_client_id) {
    return NextResponse.json({ error: 'attorney_client_id is required' }, { status: 400 })
  }

  const { data: row, error: fetchError } = await admin
    .from('attorney_clients')
    .select('id, client_id')
    .eq('id', attorney_client_id)
    .eq('attorney_id', attorneyListingId)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  const { data: household } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', row.client_id)
    .single()

  const { error: updateError } = await admin
    .from('attorney_clients')
    .update({ status: 'removed' })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
  }

  if (household?.owner_id) {
    await admin
      .from('connection_requests')
      .update({ status: 'cancelled' })
      .eq('listing_type', 'attorney')
      .eq('listing_id', attorneyListingId)
      .eq('consumer_id', household.owner_id)
      .eq('status', 'pending')
  }

  const attorneyLabel = profile?.full_name?.trim() || 'The attorney'
  const ownerId = household?.owner_id

  if (ownerId) {
    ;(async () => {
      try {
        await admin.rpc('create_notification', {
          p_user_id: ownerId,
          p_type: 'consumer_connection_declined',
          p_title: 'Connection request declined',
          p_body: `${attorneyLabel} was unable to take on new clients at this time.`,
          p_delivery: 'in_app',
          p_metadata: { attorney_client_id },
          p_cooldown: '1 hour',
        })
      } catch {
        // non-fatal
      }
    })()
  }

  return NextResponse.json({ success: true })
}

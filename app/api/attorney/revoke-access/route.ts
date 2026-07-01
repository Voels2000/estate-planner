import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { resolveAttorneyProfileId } from '@/lib/attorney/resolveAttorneyProfileId'
import { restoreAttorneyConsumerBillingOnDisconnect } from '@/lib/attorney/restoreAttorneyConsumerBillingOnDisconnect'
import { afterAttorneyConnectionBillingDisconnect } from '@/lib/billing/attorneyConnectionBilling'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connection_id } = await req.json()
  if (!connection_id) {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
  }

  const { data: connection, error: fetchError } = await supabase
    .from('attorney_clients')
    .select('id, attorney_id, client_id, status')
    .eq('id', connection_id)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const attorneyListingId = await getAttorneyListingIdForUser(supabase, user.id)
  const isConsumer = household?.id === connection.client_id
  const isAttorney = attorneyListingId != null && attorneyListingId === connection.attorney_id

  if (!isConsumer && !isAttorney) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['active', 'accepted'].includes(connection.status)) {
    return NextResponse.json(
      { error: 'Connection is not active and cannot be revoked' },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('attorney_clients')
    .update({
      status: 'revoked',
      revoked_at: now,
      revoked_by: user.id,
    })
    .eq('id', connection_id)

  if (updateError) {
    console.error('revoke-access update error:', updateError)
    return NextResponse.json({ error: 'Failed to revoke connection' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: consumerHousehold } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', connection.client_id)
    .maybeSingle()

  if (consumerHousehold?.owner_id) {
    await restoreAttorneyConsumerBillingOnDisconnect(admin, {
      clientId: consumerHousehold.owner_id,
      attorneyClientRowId: connection_id,
      attorneyListingId: connection.attorney_id,
      sendEmail: false,
    })
  }

  await afterAttorneyConnectionBillingDisconnect(connection.attorney_id)

  const attorneyProfileId = await resolveAttorneyProfileId(admin, connection.attorney_id)
  const notifyUserId = isConsumer ? attorneyProfileId : consumerHousehold?.owner_id

  const { data: revokerProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  let notifyEmail: string | null = null
  let notifyName: string | null = null

  if (isConsumer) {
    const { data: attorneyListing } = await supabase
      .from('attorney_listings')
      .select('email, contact_name, profile_id')
      .eq('id', connection.attorney_id)
      .single()
    notifyEmail = attorneyListing?.email ?? null
    notifyName = attorneyListing?.contact_name ?? null
  } else if (consumerHousehold?.owner_id) {
    const { data: consumerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', consumerHousehold.owner_id)
      .single()
    notifyEmail = consumerProfile?.email ?? null
    notifyName = consumerProfile?.full_name ?? null
  }

  if (notifyEmail) {
    try {
      const appUrl = getAppUrl()
      await fetch(`${appUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: notifyEmail,
          bcc: 'avoels@comcast.net',
          subject: 'Attorney access has been revoked on My Wealth Maps',
          html: `
            <p>Hi ${notifyName ?? 'there'},</p>
            <p><strong>${revokerProfile?.full_name ?? 'A user'}</strong> has revoked 
            attorney access on My Wealth Maps.</p>
            <p>Any documents already uploaded remain safely stored in the client vault.</p>
            <p><a href="${appUrl}/dashboard">Go to Dashboard</a></p>
          `,
        }),
      })
    } catch (emailError) {
      console.error('revoke-access email error:', emailError)
    }
  }

  if (notifyUserId) {
    try {
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        type: 'attorney_access_revoked',
        title: 'Attorney access revoked',
        body: `${revokerProfile?.full_name ?? 'A user'} has revoked attorney portal access.`,
        delivery: 'in_app',
        read: false,
      })
    } catch (notifyError) {
      console.error('revoke-access notification error:', notifyError)
    }
  }

  return NextResponse.json({
    success: true,
    revoked_at: now,
    revoked_by: user.id,
  })
}

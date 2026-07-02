import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAttorneyConnectionBilling } from '@/lib/attorney/applyAttorneyConnectionBilling'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { requireActionStepUpApi } from '@/lib/security/requireActionStepUpApi'
import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import {
  countActiveAttorneyClients,
  getAttorneyClientCapMessage,
  getAttorneyListingIdForUser,
  isAtAttorneyClientCap,
} from '@/lib/attorney/attorneyClientCap'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  afterAttorneyConnectionBillingConnect,
  assessAttorneyConnectionBillingGate,
} from '@/lib/billing/attorneyConnectionBilling'
import { EMAIL_FROM } from '@/lib/email/config'
import {
  assertProfessionalCredentialForConnect,
  type ConnectCredentialInput,
} from '@/lib/directory/professionalCredential'
import { assertAttorneyPracticeProfileForPaidConsumerConnect } from '@/lib/attorney/attorneyListingPracticeProfile'

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
  const stepUpBlock = await requireActionStepUpApi(supabase)
  if (stepUpBlock) return stepUpBlock

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, attorney_tier')
    .eq('id', user.id)
    .single()

  const attorneyListingId = await getAttorneyListingIdForUser(supabase, user.id)
  if (!attorneyListingId) {
    return NextResponse.json({ error: 'Attorney listing not found' }, { status: 404 })
  }

  const activeCount = await countActiveAttorneyClients(admin, attorneyListingId)
  if (!isConnectionBillingEnabled()) {
    if (isAtAttorneyClientCap(profile?.attorney_tier ?? 0, activeCount)) {
      return NextResponse.json({ error: getAttorneyClientCapMessage() }, { status: 403 })
    }
  }

  const body = (await request.json()) as {
    attorney_client_id?: string
  } & ConnectCredentialInput
  const { attorney_client_id, bar_number, bar_state, crd_number: _crd } = body
  if (!attorney_client_id) {
    return NextResponse.json({ error: 'attorney_client_id is required' }, { status: 400 })
  }

  const { data: row, error: fetchError } = await admin
    .from('attorney_clients')
    .select('id, client_id, status')
    .eq('id', attorney_client_id)
    .eq('attorney_id', attorneyListingId)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (isConnectionBillingEnabled()) {
    const gate = await assessAttorneyConnectionBillingGate(admin, attorneyListingId, row.client_id)
    if (!gate.ok) return gate.response
  }

  const { data: consumerProfileForGate } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', row.client_id)
    .maybeSingle()

  const { data: consumerSubscription } = consumerProfileForGate?.owner_id
    ? await admin
        .from('profiles')
        .select('subscription_status')
        .eq('id', consumerProfileForGate.owner_id)
        .maybeSingle()
    : { data: null }

  const practiceGate = await assertAttorneyPracticeProfileForPaidConsumerConnect(admin, {
    listingId: attorneyListingId,
    householdId: row.client_id,
    consumerSubscriptionStatus: consumerSubscription?.subscription_status,
  })
  if (!practiceGate.ok) {
    return NextResponse.json(practiceGate.body, { status: practiceGate.status })
  }

  const credentialGate = await assertProfessionalCredentialForConnect(admin, {
    type: 'attorney',
    listingId: attorneyListingId,
    input: { bar_number, bar_state },
  })
  if (!credentialGate.ok) {
    return NextResponse.json(credentialGate.body, { status: credentialGate.status })
  }

  const { data: household } = await admin
    .from('households')
    .select('owner_id')
    .eq('id', row.client_id)
    .single()

  const { data: consumer } = household?.owner_id
    ? await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', household.owner_id)
        .single()
    : { data: null }

  if (!consumer?.email) {
    return NextResponse.json({ error: 'Consumer profile not found' }, { status: 404 })
  }

  const { error: updateError } = await admin
    .from('attorney_clients')
    .update({
      status: 'active',
      granted_at: new Date().toISOString(),
      granted_by: user.id,
      invite_token: null,
      invite_expires_at: null,
      matter_stage: 'intake',
      client_status: 'active',
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  if (household?.owner_id) {
    await applyAttorneyConnectionBilling(admin, {
      clientId: household.owner_id,
      attorneyClientRowId: row.id,
    })
  }

  if (isConnectionBillingEnabled()) {
    await afterAttorneyConnectionBillingConnect(admin, attorneyListingId)
  }

  await admin
    .from('connection_requests')
    .update({ status: 'accepted' })
    .eq('listing_type', 'attorney')
    .eq('listing_id', attorneyListingId)
    .eq('consumer_id', household!.owner_id)
    .eq('status', 'pending')

  const attorneyLabel = profile?.full_name?.trim() || 'Your attorney'
  const appUrl = getAppUrl()

  ;(async () => {
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
        tags: [{ name: 'category', value: 'attorney_accept' }],
        to: consumer.email,
        subject: `${attorneyLabel} accepted your connection request`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
            <h1 style="color:#1a1a2e;font-size:24px">My Wealth Maps</h1>
            <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
            <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
              <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You're now connected</h2>
              <p style="color:#374151;font-size:16px;line-height:1.6"><strong>${attorneyLabel}</strong> has accepted your connection request and can now view your estate data (read-only) and collaborate on documents.</p>
              <p style="color:#374151;font-size:16px;line-height:1.6">You retain ownership of your data and can revoke access anytime in My Attorney.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${appUrl}/my-attorney" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">Manage attorney access</a>
              </div>
            </div>
          </div>
        `,
      })

      if (household?.owner_id) {
        await admin.rpc('create_notification', {
          p_user_id: household.owner_id,
          p_type: 'attorney_connection_accepted',
          p_title: 'Attorney connected',
          p_body: `${attorneyLabel} accepted your connection request.`,
          p_delivery: 'in_app',
          p_metadata: { attorney_client_id: row.id },
          p_cooldown: '1 hour',
        })
      }
    } catch (err) {
      console.error('Accept notification error:', err)
    }
  })()

  return NextResponse.json({ success: true })
}

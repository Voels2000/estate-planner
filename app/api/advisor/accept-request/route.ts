import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { resend } from '@/lib/resend'
import { getAppUrl } from '@/lib/app-url'
import { pickConnectionLifeEvent } from '@/lib/life-events/connectionContext'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { applyAdvisorConnectionBilling } from '@/lib/advisor/applyAdvisorConnectionBilling'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { getAdvisorClientCapacity } from '@/lib/advisor/advisorClientLimits'
import {
  assessFirmConnectionBillingGate,
  getAdvisorFirmBillingContext,
  syncFirmConnectionBillingQuantity,
} from '@/lib/billing/firmConnectionBilling'
import { EMAIL_FROM } from '@/lib/email/config'
import {
  assertProfessionalCredentialForConnect,
  getAdvisorDirectoryListingIdForUser,
  type ConnectCredentialInput,
} from '@/lib/directory/professionalCredential'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, isSuperuser, isAdvisor } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperuser && !isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || (!isSuperuser && profile.role !== 'advisor')) {
    return NextResponse.json({ error: 'Advisor access required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    advisor_client_id?: string
  } & ConnectCredentialInput
  const { advisor_client_id, crd_number, bar_number: _bar, bar_state: _state } = body
  if (!advisor_client_id) {
    return NextResponse.json({ error: 'advisor_client_id is required' }, { status: 400 })
  }

  // Fetch the request row — must belong to this advisor and be consumer_requested
  const { data: row, error: fetchError } = await admin
    .from('advisor_clients')
    .select('id, client_id, status')
    .eq('id', advisor_client_id)
    .eq('advisor_id', user.id)
    .eq('status', 'consumer_requested')
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (isConnectionBillingEnabled()) {
    const gate = await assessFirmConnectionBillingGate(admin, user.id, row.client_id)
    if (!gate.ok) return gate.response
  } else {
    const { cap, current, atLimit, tierName } = await getAdvisorClientCapacity(admin, user.id)
    if (atLimit) {
      return NextResponse.json({
        error: 'tier_limit_reached',
        current_count: current,
        max_clients: cap,
        tier_name: tierName,
      }, { status: 403 })
    }
  }

  const advisorListingId = await getAdvisorDirectoryListingIdForUser(admin, user.id)
  if (!advisorListingId) {
    return NextResponse.json({ error: 'Advisor listing not found' }, { status: 404 })
  }

  const credentialGate = await assertProfessionalCredentialForConnect(admin, {
    type: 'advisor',
    listingId: advisorListingId,
    input: { crd_number },
  })
  if (!credentialGate.ok) {
    return NextResponse.json(credentialGate.body, { status: credentialGate.status })
  }

  // Fetch consumer profile for notification email
  const { data: consumer } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.client_id)
    .single()

  if (!consumer?.email) {
    return NextResponse.json({ error: 'Consumer profile not found' }, { status: 404 })
  }

  const lifeEventSnapshot = await pickConnectionLifeEvent(admin, row.client_id)

  // Directly activate — no second confirmation step required (Sprint 55 architectural change)
  // Advisor gets immediate read-only access to estate documents and strategy output
  const { error: updateError } = await admin
    .from('advisor_clients')
    .update({
      status: 'active',
      accepted_at: new Date().toISOString(),
      connection_life_event_type: lifeEventSnapshot?.event_type ?? null,
      connection_life_event_at: lifeEventSnapshot?.recorded_at ?? null,
      // Clear any stale invite token fields
      invite_token: null,
      invite_expires_at: null,
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  const clientId = row.client_id
  const advisorClientRowId = row.id

  after(() => {
    const adminAfter = createAdminClient()
    ;(async () => {
      try {
        const billing = await applyAdvisorConnectionBilling(adminAfter, {
          clientId,
          advisorClientRowId,
        })

        if (billing.ok) {
          await adminAfter.rpc('create_notification', {
            p_user_id: clientId,
            p_type: 'estate_milestone',
            p_title: '🎉 Estate Planning unlocked!',
            p_body:
              'Your advisor accepted your connection request. Estate Planning features are now available and your subscription will be covered going forward.',
            p_delivery: 'both',
            p_metadata: {
              advisor_id: user.id,
              unlocked_tier: 3,
              cancel_at: billing.cancelAt,
            },
            p_cooldown: '1 hour',
          })
        }

        const { firmId } = await getAdvisorFirmBillingContext(adminAfter, user.id)
        await syncFirmConnectionBillingQuantity(firmId)
      } catch (err) {
        console.error('accept-request billing after():', err)
      }
    })()
  })

  void admin.from('funnel_events').insert({
    event_name: 'advisor_connected',
    user_id: row.client_id,
    properties: {
      advisor_id: user.id,
      advisor_client_id: row.id,
      ...(lifeEventSnapshot
        ? {
            connection_life_event_type: lifeEventSnapshot.event_type,
            connection_life_event_label: lifeEventSnapshot.event_label,
          }
        : {}),
    },
  }).then(({ error: funnelErr }) => {
    if (funnelErr) console.error('advisor_connected funnel event:', funnelErr)
  })

  // Notify consumer that advisor accepted — no action required from consumer
  const advisorLabel = profile.full_name?.trim() || profile.email || 'Your advisor'
  const appUrl = getAppUrl()

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
      tags: [{ name: 'category', value: 'advisor_accept' }],
      to: consumer.email,
      subject: `${advisorLabel} accepted your connection request`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#1a1a2e;font-size:24px">My Wealth Maps</h1>
          <p style="color:#6b7280;font-size:14px">Financial, Retirement &amp; Estate Planning in One Place</p>
          <div style="background:#f9fafb;border-radius:8px;padding:32px;margin:24px 0">
            <h2 style="color:#1a1a2e;font-size:20px;margin-top:0">You're now connected</h2>
            <p style="color:#374151;font-size:16px;line-height:1.6">
              <strong>${advisorLabel}</strong> has accepted your connection request.
              They now have read-only access to your estate documents and strategy to help you plan.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${appUrl}/dashboard" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
                View My Dashboard
              </a>
            </div>
            <p style="color:#6b7280;font-size:14px">
              You can manage advisor access at any time in your account settings.
            </p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">
            My Wealth Maps · Estate Planning Platform
          </p>
        </div>
      `,
    })
  } catch (err) {
    // Non-fatal — connection is active, email is best-effort
    console.error('Notification email error:', err)
  }

  if (isSuperuser) {
    await admin.from('superuser_action_log').insert({
      user_id: user.id,
      endpoint: '/api/advisor/accept-request',
      target_id: advisor_client_id,
      action: 'accept-request',
    })
  }

  return NextResponse.json({ success: true })
}

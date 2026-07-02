import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAttorneyConnectionBilling } from '@/lib/attorney/applyAttorneyConnectionBilling'
import { createClient } from '@/lib/supabase/server'
import { resolveAttorneyProfileId } from '@/lib/attorney/resolveAttorneyProfileId'
import { resolveConsumerHouseholdId } from '@/lib/attorney/verifyAttorneyHouseholdAccess'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import {
  afterAttorneyConnectionBillingConnect,
  assessAttorneyConnectionBillingGate,
} from '@/lib/billing/attorneyConnectionBilling'
import {
  assertAttorneyPracticeProfileForPaidConsumerConnect,
  consumerAttorneyPracticeProfileBlockedMessage,
} from '@/lib/attorney/attorneyListingPracticeProfile'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { token } = (await request.json()) as { token?: string }
  if (!token?.trim()) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('attorney_clients')
    .select('id, attorney_id, invited_email, status, invite_expires_at')
    .eq('invite_token', token.trim())
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (new Date(invite.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }

  const householdId = await resolveConsumerHouseholdId(admin, user.id)
  if (!householdId) {
    return NextResponse.json({ error: 'missing_household' }, { status: 400 })
  }

  if (isConnectionBillingEnabled()) {
    const gate = await assessAttorneyConnectionBillingGate(admin, invite.attorney_id, householdId)
    if (!gate.ok) return gate.response
  }

  const { data: consumerSubscription } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle()

  const practiceGate = await assertAttorneyPracticeProfileForPaidConsumerConnect(admin, {
    listingId: invite.attorney_id,
    householdId,
    consumerSubscriptionStatus: consumerSubscription?.subscription_status,
  })
  if (!practiceGate.ok) {
    return NextResponse.json(
      {
        error: consumerAttorneyPracticeProfileBlockedMessage(),
        practice_profile_required: true,
      },
      { status: practiceGate.status },
    )
  }

  const { error: acceptError } = await admin
    .from('attorney_clients')
    .update({
      client_id: householdId,
      status: 'accepted',
      billing_transferred: false,
    })
    .eq('id', invite.id)

  if (acceptError) {
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }

  const attorneyProfileId = await resolveAttorneyProfileId(admin, invite.attorney_id)

  await applyAttorneyConnectionBilling(admin, {
    clientId: user.id,
    attorneyClientRowId: invite.id,
  })

  if (isConnectionBillingEnabled()) {
    await afterAttorneyConnectionBillingConnect(admin, invite.attorney_id)
  }

  after(() => {
    const bgAdmin = createAdminClient()
    void (async () => {
      try {
        if (attorneyProfileId) {
          await bgAdmin.rpc('create_notification', {
            p_user_id: attorneyProfileId,
            p_type: 'client_accepted_invite',
            p_title: 'A client accepted your invitation',
            p_body: 'A new client has accepted your invitation and is now linked to your account.',
            p_delivery: 'both',
            p_metadata: { client_id: user.id, household_id: householdId },
            p_cooldown: '1 hour',
          })
        }

        await bgAdmin.rpc('create_notification', {
          p_user_id: user.id,
          p_type: 'estate_milestone',
          p_title: '✅ Connected to your attorney',
          p_body: 'You are now connected with your attorney on My Wealth Maps. They can collaborate with you on your estate plan.',
          p_delivery: 'both',
          p_metadata: { attorney_listing_id: invite.attorney_id },
          p_cooldown: '1 hour',
        })
      } catch (err) {
        console.error('accept-invite after(): error', err)
      }
    })()
  })

  return NextResponse.json({ success: true })
}

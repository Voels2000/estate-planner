import { createAdminClient } from '@/lib/supabase/admin'

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}

/**
 * Fire-and-forget: notify parties when an attorney referral status changes.
 * Uses service role — call from Route Handlers or `after()` (not from the browser).
 * Persist status on `attorney_referrals` in the same request before calling this.
 */
export function fireReferralStatusUpdateNotification(
  referralId: string,
  newStatus: string,
  updatedBy: string
) {
  ;(async () => {
    try {
      const admin = createAdminClient()

      const { data: referral, error } = await admin
        .from('attorney_referrals')
        .select('id, requested_by, client_id, advisor_id, attorney_id, status')
        .eq('id', referralId)
        .single()

      if (error || !referral) {
        console.error('referral-notifications: fetch error', error)
        return
      }

      const statusLabel = REFERRAL_STATUS_LABEL[newStatus] ?? newStatus
      const title = `Referral status updated: ${statusLabel}`
      const body = `Your attorney referral status has been updated to "${statusLabel}".`

      const notifyUserIds = Array.from(
        new Set(
          [referral.requested_by, referral.client_id, referral.advisor_id].filter(
            Boolean
          ) as string[]
        )
      )

      for (const userId of notifyUserIds) {
        await admin.rpc('create_notification', {
          p_user_id: userId,
          p_type: 'referral_status_update',
          p_title: title,
          p_body: body,
          p_delivery: 'both',
          p_metadata: {
            referral_id: referralId,
            new_status: newStatus,
            updated_by: updatedBy,
          },
          p_cooldown: '1 hour',
        })
      }
    } catch (err) {
      console.error('referral-notifications: unexpected error', err)
    }
  })()
}

export async function fireAdvisorConnectionRequestNotification(
  advisorClientId: string,
  advisorId: string,
  clientId: string
) {
  const admin = createAdminClient()

  const { data: clientProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', clientId)
    .maybeSingle()

  const clientLabel =
    clientProfile?.full_name?.trim() ||
    clientProfile?.email?.trim() ||
    'A subscriber'

  // Notify advisor — email + in-app
  await admin.rpc('create_notification', {
    p_user_id: advisorId,
    p_type: 'consumer_connection_request',
    p_title: 'New connection request',
    p_body: `${clientLabel} requested to connect with you. Open your advisor portal to respond.`,
    p_delivery: 'both',
    p_metadata: {
      advisor_client_id: advisorClientId,
      client_id: clientId,
    },
    p_cooldown: '1 hour',
  })

  // Notify consumer — in-app confirmation only
  await admin.rpc('create_notification', {
    p_user_id: clientId,
    p_type: 'consumer_connection_request_sent',
    p_title: 'Connection request sent',
    p_body: 'Your request has been sent. The advisor will be in touch if they accept.',
    p_delivery: 'in_app',
    p_metadata: {
      advisor_client_id: advisorClientId,
      advisor_id: advisorId,
    },
    p_cooldown: '1 hour',
  })
}

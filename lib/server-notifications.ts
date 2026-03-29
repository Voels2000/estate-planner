import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fire-and-forget: notify a consumer that their attorney referral status changed.
 * Uses service role — call from Route Handlers or `after()` (not from the browser).
 */
export function fireReferralStatusUpdateNotification(userId: string, referralId: string) {
  const admin = createAdminClient()
  void admin
    .rpc('create_notification', {
      p_user_id: userId,
      p_type: 'referral_status_update',
      p_title: 'Your attorney referral has been updated',
      p_body:
        'Your referral status has been updated. Visit referrals to see the latest.',
      p_delivery: 'both',
      p_metadata: { referral_id: referralId },
      p_cooldown: '1 hour',
    })
    .then(() => {})
    .catch(() => {})
}

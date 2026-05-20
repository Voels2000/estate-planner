import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Call after a successful Stripe checkout or tier change.
 */
export async function trackTierUpgrade(params: {
  userId: string
  tier: number
  previousTier: number
}) {
  try {
    const admin = createAdminClient()
    await admin.from('funnel_events').insert({
      event_name: 'tier_upgraded',
      user_id: params.userId,
      properties: {
        tier: params.tier,
        previous_tier: params.previousTier,
      },
    })
  } catch {
    // never throw
  }
}

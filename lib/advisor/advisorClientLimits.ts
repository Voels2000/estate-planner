import type { SupabaseClient } from '@supabase/supabase-js'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

const ACTIVE_FIRM_STATUSES = new Set(['active', 'trialing'])

export type AdvisorClientCapacity = {
  cap: number | null
  current: number
  atLimit: boolean
  tierName: string
}

/**
 * Firm advisors may connect unlimited consumer households per seat (B2B2C policy).
 * Requires an active firm subscription; no per-tier client cap.
 */
export async function getAdvisorClientCapacity(
  admin: SupabaseClient,
  advisorId: string,
): Promise<AdvisorClientCapacity> {
  const { data: currentClients } = await admin
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES, 'pending', 'consumer_requested'])

  const current = currentClients?.length ?? 0

  const { data: advisorProfile } = await admin
    .from('profiles')
    .select('firm_id')
    .eq('id', advisorId)
    .maybeSingle()

  if (!advisorProfile?.firm_id) {
    return { cap: null, current, atLimit: true, tierName: 'none' }
  }

  const { data: firm } = await admin
    .from('firms')
    .select('tier, subscription_status')
    .eq('id', advisorProfile.firm_id)
    .maybeSingle()

  if (!firm || !ACTIVE_FIRM_STATUSES.has(firm.subscription_status ?? '')) {
    return { cap: null, current, atLimit: true, tierName: firm?.tier ?? 'none' }
  }

  return {
    cap: null,
    current,
    atLimit: false,
    tierName: firm.tier ?? 'starter',
  }
}

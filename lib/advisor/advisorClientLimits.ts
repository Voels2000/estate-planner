import type { SupabaseClient } from '@supabase/supabase-js'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

export const ADVISOR_CLIENT_LIMITS: Record<string, number> = {
  advisor_starter: 10,
  advisor_pro: 50,
  advisor_enterprise: 9999,
  active: 10,
  trialing: 10,
}

export function getAdvisorClientLimit(subscriptionStatus: string | null | undefined): number {
  if (!subscriptionStatus) return ADVISOR_CLIENT_LIMITS.advisor_starter
  return ADVISOR_CLIENT_LIMITS[subscriptionStatus] ?? ADVISOR_CLIENT_LIMITS.advisor_starter
}

export async function getAdvisorClientCapacity(
  admin: SupabaseClient,
  advisorId: string,
): Promise<{ currentCount: number; maxClients: number; tierName: string }> {
  const { data: currentClients } = await admin
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES, 'pending', 'consumer_requested'])

  const { data: advisorProfile } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', advisorId)
    .maybeSingle()

  const tierName = advisorProfile?.subscription_status ?? 'advisor_starter'
  const maxClients = getAdvisorClientLimit(tierName)
  const currentCount = currentClients?.length ?? 0

  return { currentCount, maxClients, tierName }
}

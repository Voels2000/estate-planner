import type { SupabaseClient } from '@supabase/supabase-js'

export const FIRM_TIER_MAX_SEATS: Record<string, number> = {
  starter: 10,
  growth: 50,
  enterprise: 250,
}

export function getFirmTierMaxSeats(tier: string | null | undefined): number {
  return FIRM_TIER_MAX_SEATS[tier ?? 'starter'] ?? 10
}

export type FirmRosterCounts = {
  active: number
  pending: number
  total: number
}

/** Non-removed firm members (owner + advisors), split by pending vs active. */
export async function countFirmRosterSeats(
  admin: SupabaseClient,
  firmId: string,
): Promise<FirmRosterCounts> {
  const { data: rows, error } = await admin
    .from('firm_members')
    .select('status')
    .eq('firm_id', firmId)
    .neq('status', 'removed')

  if (error) {
    throw error
  }

  let active = 0
  let pending = 0
  for (const row of rows ?? []) {
    if (row.status === 'pending') pending += 1
    else if (row.status === 'active') active += 1
  }

  return { active, pending, total: active + pending }
}

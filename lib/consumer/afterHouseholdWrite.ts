import type { createClient } from '@/lib/supabase/server'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'

export function getConsumerAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function touchHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
) {
  await supabase
    .from('households')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', householdId)
}

export function triggerHouseholdRecompute(householdId: string) {
  void triggerEstateHealthRecompute(householdId, getConsumerAppUrl())
}

/** Touch staleness timestamp and fire estate health recompute (non-blocking). */
export async function afterHouseholdWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
) {
  await touchHousehold(supabase, householdId)
  triggerHouseholdRecompute(householdId)
}

/** Resolve household id for the authenticated owner; optional id must match. */
export async function resolveOwnedHouseholdId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  householdId?: string,
): Promise<string | null> {
  let query = supabase.from('households').select('id').eq('owner_id', userId)
  if (householdId) {
    query = query.eq('id', householdId)
  }
  const { data } = await query.single()
  return data?.id ?? null
}

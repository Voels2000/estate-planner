import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { upsertCompositionCache } from '@/lib/estate/getCachedComposition'
import type { EstateComposition } from '@/lib/estate/types'

/** Refresh composition cache from live RPC (service role). */
export async function recomputeCompositionCache(
  admin: SupabaseClient,
  householdId: string,
): Promise<{ consumer: EstateComposition; lifetimeGiftsUsed: number }> {
  const { data: giftingSummary } = await admin.rpc('calculate_gifting_summary', {
    p_household_id: householdId,
  })
  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingSummary as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0,
    ),
  )

  const [consumer, advisor] = await Promise.all([
    classifyEstateAssets(admin, householdId, 'consumer', lifetimeGiftsUsed),
    classifyEstateAssets(admin, householdId, 'advisor', lifetimeGiftsUsed),
  ])

  await Promise.all([
    upsertCompositionCache(admin, householdId, 'consumer', consumer, lifetimeGiftsUsed),
    upsertCompositionCache(admin, householdId, 'advisor', advisor, lifetimeGiftsUsed),
  ])

  return { consumer, lifetimeGiftsUsed }
}

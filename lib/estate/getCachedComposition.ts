import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import type { EstateComposition } from '@/lib/estate/types'

/** Read cached composition; fall back to live RPC when cache is missing. */
export async function getCachedComposition(
  supabase: SupabaseClient,
  householdId: string,
  sourceRole: 'consumer' | 'advisor' = 'consumer',
  lifetimeGiftsUsed = 0,
): Promise<EstateComposition> {
  const { data: cached } = await supabase
    .from('estate_composition_cache')
    .select('composition, lifetime_gifts_used')
    .eq('household_id', householdId)
    .eq('source_role', sourceRole)
    .maybeSingle()

  if (cached?.composition && typeof cached.composition === 'object') {
    const cachedGifts = Math.max(0, Number(cached.lifetime_gifts_used ?? 0) || 0)
    const requestedGifts = Math.max(0, lifetimeGiftsUsed)
    if (cachedGifts === requestedGifts) {
      return cached.composition as EstateComposition
    }
  }

  return classifyEstateAssets(
    supabase,
    householdId,
    sourceRole,
    lifetimeGiftsUsed,
  )
}

/** Upsert composition cache rows (service role / recompute pipeline). */
export async function upsertCompositionCache(
  supabase: SupabaseClient,
  householdId: string,
  sourceRole: 'consumer' | 'advisor',
  composition: EstateComposition,
  lifetimeGiftsUsed: number,
): Promise<void> {
  const { error } = await supabase.from('estate_composition_cache').upsert(
    {
      household_id: householdId,
      source_role: sourceRole,
      composition,
      lifetime_gifts_used: Math.max(0, lifetimeGiftsUsed),
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,source_role' },
  )
  if (error) {
    console.error('[upsertCompositionCache]', error.message)
  }
}

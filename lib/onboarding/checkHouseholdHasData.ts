import type { SupabaseClient } from '@supabase/supabase-js'

/** True when the household has at least one asset or non-SS income row. */
export async function checkHouseholdHasData(
  supabase: SupabaseClient,
  householdOwnerId: string,
): Promise<boolean> {
  const [{ count: assetCount }, { count: incomeCount }] = await Promise.all([
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', householdOwnerId),
    supabase
      .from('income')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', householdOwnerId),
  ])

  const assets = assetCount ?? 0
  const income = incomeCount ?? 0
  return assets > 0 || income > 0
}

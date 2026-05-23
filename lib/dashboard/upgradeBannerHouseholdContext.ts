import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { displayPersonFirstName } from '@/lib/display-person-name'

export type UpgradeBannerHouseholdContext = {
  grossEstate: number | null
  statePrimary: string | null
  firstName: string | null
}

/** Household + composition for UpgradeBanner personalization (gate branches only). */
export async function loadUpgradeBannerHouseholdContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<UpgradeBannerHouseholdContext> {
  const { data: householdRow } = await supabase
    .from('households')
    .select('id, state_primary, person1_name')
    .eq('owner_id', userId)
    .maybeSingle()

  let grossEstate: number | null = null
  if (householdRow?.id) {
    const composition = await classifyEstateAssets(supabase, householdRow.id, 'consumer', 0)
    grossEstate = composition.gross_estate ?? null
  }

  return {
    grossEstate,
    statePrimary: householdRow?.state_primary ?? null,
    firstName: displayPersonFirstName(householdRow?.person1_name) || null,
  }
}

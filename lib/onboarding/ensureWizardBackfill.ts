import type { SupabaseClient } from '@supabase/supabase-js'
import { checkHouseholdHasData } from '@/lib/onboarding/checkHouseholdHasData'

/** Auto-complete wizard for households that already have assets or income. */
export async function ensureWizardBackfill(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const hasData = await checkHouseholdHasData(supabase, userId)
  if (!hasData) return false

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_wizard_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)
    .is('onboarding_wizard_completed_at', null)

  return !error
}

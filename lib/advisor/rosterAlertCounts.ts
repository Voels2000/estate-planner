import type { SupabaseClient } from '@supabase/supabase-js'

export type RosterAlertCounts = { high: number; medium: number }

export async function loadRosterAlertCounts(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<Record<string, RosterAlertCounts>> {
  if (householdIds.length === 0) return {}

  const { data, error } = await supabase
    .from('household_alerts')
    .select('household_id, severity')
    .in('household_id', householdIds)
    .is('resolved_at', null)
    .is('dismissed_at', null)

  if (error || !data) return {}

  const map: Record<string, RosterAlertCounts> = {}
  for (const row of data) {
    const hid = row.household_id as string
    if (!map[hid]) map[hid] = { high: 0, medium: 0 }
    const sev = String(row.severity ?? '')
    if (sev === 'high' || sev === 'critical') {
      map[hid].high += 1
    } else if (sev === 'medium' || sev === 'warning') {
      map[hid].medium += 1
    }
  }
  return map
}

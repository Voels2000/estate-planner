import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectConflicts } from '@/lib/conflict-detector'

export const dynamic = 'force-dynamic'

/**
 * Re-runs beneficiary / titling conflict detection after titling changes.
 * Updates beneficiary_conflicts, estate_health_scores, and household_alerts.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household?.id) {
    return NextResponse.json({ ok: true })
  }

  await detectConflicts(household.id, user.id)
  return NextResponse.json({ ok: true })
}

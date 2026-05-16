/**
 * Save a scenario comparison snapshot to the `projections` archive table.
 * Consumer scenarios page uses this after computing rows via GET `/api/projection`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'
import { buildScenarioSnapshot } from '@/lib/scenarios/buildScenarioSnapshot'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const built = buildScenarioSnapshot(owned.householdId, body)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

  const { data, error } = await supabase
    .from('projections')
    .insert(built.row)
    .select('id, scenario_name, calculated_at')
    .single()

  if (error) {
    console.error('[scenario-snapshots]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

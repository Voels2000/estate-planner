import { createAdminClient } from '@/lib/supabase/admin'
import { computeEstateHealthScore } from '@/lib/estate-health-score'
import { detectConflicts } from '@/lib/conflict-detector'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = request.headers.get('x-recompute-secret')
  if (secret !== process.env.RECOMPUTE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { householdId } = await request.json()
    if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: household } = await supabase
      .from('households')
      .select('id, owner_id')
      .eq('id', householdId)
      .single()

    if (!household) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Run both in parallel — these are the write-heavy operations
    // removed from the render path
    await Promise.all([
      computeEstateHealthScore(householdId, household.owner_id),
      detectConflicts(householdId, household.owner_id),
    ])

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

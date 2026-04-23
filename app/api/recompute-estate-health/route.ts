import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { computeEstateHealthScore } from '@/lib/estate-health-score'
import { detectConflicts } from '@/lib/conflict-detector'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { householdId } = await req.json()
    if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

    // Verify ownership
    const admin = createAdminClient()
    const { data: household } = await admin
      .from('households')
      .select('id, owner_id')
      .eq('id', householdId)
      .single()

    if (!household || household.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Run both in parallel — these are the write-heavy operations
    // removed from the render path
    await Promise.all([
      computeEstateHealthScore(householdId, user.id),
      detectConflicts(householdId, user.id),
    ])

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

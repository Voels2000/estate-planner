// app/api/estate-composition/route.ts
// POST /api/estate-composition
// Body: { householdId: string, sourceRole?: 'consumer' | 'advisor' }
// Returns: EstateComposition JSON
//
// Called by EstateCompositionCard on consumer dashboard,
// My Estate Strategy page, and advisor EstateTab.
// Auth-gated — requires an authenticated Supabase session.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { householdId?: string; sourceRole?: 'consumer' | 'advisor' }
    const parsed = parseHouseholdIdBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }
    const { sourceRole } = body
    const householdId = parsed.householdId

    const supabase = await createClient()

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const access = await requireHouseholdAccess(supabase, user.id, householdId)
    if (!access.ok) return access.response

    const normalizedSourceRole: 'consumer' | 'advisor' =
      sourceRole === 'advisor' ? 'advisor' : 'consumer'

    const giftingSummary = await supabase.rpc('calculate_gifting_summary', {
      p_household_id: householdId,
    })
    const lifetimeGiftsUsed = Math.max(
      0,
      Number(
        (giftingSummary.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
          0,
      ) || 0,
    )

    const composition = await getCachedComposition(
      supabase,
      householdId,
      normalizedSourceRole,
      lifetimeGiftsUsed,
    )

    return NextResponse.json(composition)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[/api/estate-composition] error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { computeEstateHealthScore } from '@/lib/estate-health-score'
import { detectConflicts } from '@/lib/conflict-detector'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { upsertCompositionCache } from '@/lib/estate/getCachedComposition'
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

    const { data: giftingSummary } = await supabase.rpc('calculate_gifting_summary', {
      p_household_id: householdId,
    })
    const lifetimeGiftsUsed = Math.max(
      0,
      Number(
        (giftingSummary as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ??
          0,
      ) || 0,
    )

    const [consumerComposition, advisorComposition] = await Promise.all([
      classifyEstateAssets(supabase, householdId, 'consumer', lifetimeGiftsUsed),
      classifyEstateAssets(supabase, householdId, 'advisor', lifetimeGiftsUsed),
    ])

    const { data: recsData } = await supabase.rpc('generate_estate_recommendations', {
      p_household_id: householdId,
      p_composition: consumerComposition,
    })

    await Promise.all([
      recsData
        ? supabase
            .from('estate_health_scores')
            .update({ recommendations: recsData })
            .eq('household_id', householdId)
        : Promise.resolve(),
      upsertCompositionCache(supabase, householdId, 'consumer', consumerComposition, lifetimeGiftsUsed),
      upsertCompositionCache(supabase, householdId, 'advisor', advisorComposition, lifetimeGiftsUsed),
    ])

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

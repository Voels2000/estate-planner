import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import { GROWTH_ASSUMPTION_DEFAULTS } from '@/lib/types/growthAssumptions'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response
  if (body.household_id) {
    const resolved = await resolveOwnedHouseholdId(supabase, user.id, body.household_id as string)
    if (!resolved || resolved !== owned.householdId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.growth_rate_accumulation != null) {
    updates.growth_rate_accumulation = Number(body.growth_rate_accumulation)
  }
  if (body.growth_rate_retirement != null) {
    updates.growth_rate_retirement = Number(body.growth_rate_retirement)
  }
  if (body.growth_assumptions != null && typeof body.growth_assumptions === 'object') {
    const ga = body.growth_assumptions as Record<string, unknown>
    updates.growth_assumptions = {
      real_estate: Number(ga.real_estate ?? GROWTH_ASSUMPTION_DEFAULTS.real_estate),
      business: Number(ga.business ?? GROWTH_ASSUMPTION_DEFAULTS.business),
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No growth fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('households')
    .update(updates)
    .eq('id', owned.householdId)
    .eq('owner_id', user.id)
    .select('id, growth_rate_accumulation, growth_rate_retirement, growth_assumptions')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, owned.householdId)

  return NextResponse.json({ household: data })
}

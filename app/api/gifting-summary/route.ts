import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { assertHouseholdAccess } from '@/lib/api/assertHouseholdAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId } = await request.json()
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  const access = await assertHouseholdAccess(supabase, user.id, householdId)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === 'not_found' ? 'Household not found' : 'Forbidden' },
      { status: access.reason === 'not_found' ? 404 : 403 },
    )
  }

  const { data, error } = await supabase.rpc('calculate_gifting_summary', {
    p_household_id: householdId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

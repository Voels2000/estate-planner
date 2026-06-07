import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

  const { data, error } = await supabase.rpc('calculate_gifting_summary', {
    p_household_id: parsed.householdId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId } = await request.json()
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  const { data, error } = await supabase.rpc('calculate_gifting_summary', {
    p_household_id: householdId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

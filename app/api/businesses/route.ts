import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  afterHouseholdWriteForOwner,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const householdId = await resolveOwnedHouseholdId(supabase, user.id)
  const body = await request.json()

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      ...body,
      owner_id: user.id,
      household_id: householdId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await afterHouseholdWriteForOwner(supabase, user.id)

  return NextResponse.json(data)
}

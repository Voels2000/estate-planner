import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import {
  buildHouseholdPersonPayload,
  HOUSEHOLD_PERSON_SELECT,
} from '@/lib/family/householdPeople'

async function verifyPersonInOwnedHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  personId: string,
): Promise<{ householdId: string } | null> {
  const ownedId = await resolveOwnedHouseholdId(supabase, userId)
  if (!ownedId) return null

  const { data } = await supabase
    .from('household_people')
    .select('id')
    .eq('id', personId)
    .eq('household_id', ownedId)
    .maybeSingle()

  return data ? { householdId: ownedId } : null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { full_name, relationship } = body

  if (!full_name?.trim() || !relationship?.trim()) {
    return NextResponse.json({ error: 'full_name and relationship required' }, { status: 400 })
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const row = buildHouseholdPersonPayload(owned.householdId, body)

  const { data, error } = await supabase
    .from('household_people')
    .insert(row)
    .select(HOUSEHOLD_PERSON_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, owned.householdId)

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, full_name, relationship } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!full_name?.trim() || !relationship?.trim()) {
    return NextResponse.json({ error: 'full_name and relationship required' }, { status: 400 })
  }

  const access = await verifyPersonInOwnedHousehold(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { household_id: _hh, ...updateFields } = buildHouseholdPersonPayload(access.householdId, body)

  const { data, error } = await supabase
    .from('household_people')
    .update(updateFields)
    .eq('id', id)
    .select(HOUSEHOLD_PERSON_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const access = await verifyPersonInOwnedHousehold(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('household_people').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json({ success: true })
}

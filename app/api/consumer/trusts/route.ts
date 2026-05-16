import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import { buildTrustRow, TRUST_SELECT } from '@/lib/trusts/trustPayload'

async function verifyTrustOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  trustId: string,
): Promise<{ householdId: string } | null> {
  const householdId = await resolveOwnedHouseholdId(supabase, userId)
  if (!householdId) return null

  const { data } = await supabase
    .from('trusts')
    .select('id')
    .eq('id', trustId)
    .eq('owner_id', userId)
    .maybeSingle()

  return data ? { householdId } : null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const built = buildTrustRow(body)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const { data, error } = await supabase
    .from('trusts')
    .insert({
      ...built.row,
      owner_id: user.id,
    })
    .select(TRUST_SELECT)
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
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const built = buildTrustRow(body)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

  const access = await verifyTrustOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('trusts')
    .update(built.row)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select(TRUST_SELECT)
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

  const access = await verifyTrustOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('trusts').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json({ success: true })
}

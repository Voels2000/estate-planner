import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  afterHouseholdWrite,
  requireOwnedHouseholdId,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import {
  ASSET_BENEFICIARY_SELECT,
  buildBeneficiaryPayload,
  parseTitlingEntityRef,
  touchBeneficiaryReview,
  verifyTitlingEntityOwnership,
} from '@/lib/titling/assetBeneficiaries'

async function verifyBeneficiaryOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  beneficiaryId: string,
): Promise<{ householdId: string } | null> {
  const ownedId = await resolveOwnedHouseholdId(supabase, userId)
  if (!ownedId) return null

  const { data } = await supabase
    .from('asset_beneficiaries')
    .select('id')
    .eq('id', beneficiaryId)
    .eq('owner_id', userId)
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
  const parsedRef = parseTitlingEntityRef(body)
  if (!parsedRef.ok) return NextResponse.json({ error: parsedRef.error }, { status: 400 })

  const built = buildBeneficiaryPayload(body)
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 })

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  if (!(await verifyTitlingEntityOwnership(supabase, user.id, parsedRef.ref))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('asset_beneficiaries')
    .insert({
      owner_id: user.id,
      ...parsedRef.ref,
      ...built.fields,
    })
    .select(ASSET_BENEFICIARY_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await touchBeneficiaryReview(supabase, owned.householdId)
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

  const built = buildBeneficiaryPayload(body)
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 })

  const access = await verifyBeneficiaryOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('asset_beneficiaries')
    .update(built.fields)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select(ASSET_BENEFICIARY_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await touchBeneficiaryReview(supabase, access.householdId)
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

  const access = await verifyBeneficiaryOwnership(supabase, user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('asset_beneficiaries').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await touchBeneficiaryReview(supabase, access.householdId)
  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json({ success: true })
}

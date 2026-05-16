import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    owner,
    type,
    name,
    value,
    cost_basis,
    basis_date,
    liquidity,
    titling,
    institution,
    account_last4,
    face_value,
    is_ilit,
    situs_state,
    situs_asset_type,
    estate_inclusion_status,
  } = body

  if (!type || !name || value == null) {
    return NextResponse.json({ error: 'type, name, value required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('assets')
    .insert({
      owner_id: user.id,
      owner: owner ?? 'person1',
      type,
      name,
      value: Number(value),
      cost_basis: cost_basis != null ? Number(cost_basis) : null,
      basis_date: basis_date || null,
      liquidity: liquidity || null,
      titling: titling || null,
      institution: institution || null,
      account_last4: account_last4 || null,
      face_value: face_value != null ? Number(face_value) : null,
      is_ilit: is_ilit ?? false,
      situs_state: situs_state || null,
      situs_asset_type: situs_asset_type || null,
      estate_inclusion_status: estate_inclusion_status ?? 'included',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, household.id)

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    id,
    owner,
    type,
    name,
    value,
    cost_basis,
    basis_date,
    liquidity,
    titling,
    institution,
    account_last4,
    face_value,
    is_ilit,
    situs_state,
    situs_asset_type,
    estate_inclusion_status,
  } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('assets')
    .update({
      owner: owner ?? 'person1',
      type,
      name,
      value: Number(value),
      cost_basis: cost_basis != null ? Number(cost_basis) : null,
      basis_date: basis_date || null,
      liquidity: liquidity || null,
      titling: titling || null,
      institution: institution || null,
      account_last4: account_last4 || null,
      face_value: face_value != null ? Number(face_value) : null,
      is_ilit: is_ilit ?? false,
      situs_state: situs_state || null,
      situs_asset_type: situs_asset_type || null,
      estate_inclusion_status: estate_inclusion_status ?? 'included',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, household.id)

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

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const { error } = await supabase.from('assets').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (household?.id) {
    await afterHouseholdWrite(supabase, household.id)
  }

  return NextResponse.json({ success: true })
}

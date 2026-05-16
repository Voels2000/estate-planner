import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'

function buildRealEstateRow(body: Record<string, unknown>, userId: string, forInsert: boolean) {
  const row: Record<string, unknown> = {
    owner: (body.owner as string) ?? 'person1',
    name: body.name,
    property_type: body.property_type ?? 'primary_residence',
    current_value: Number(body.current_value),
    purchase_price: body.purchase_price != null ? Number(body.purchase_price) : null,
    purchase_year: body.purchase_year != null ? Number(body.purchase_year) : null,
    mortgage_balance: body.mortgage_balance != null ? Number(body.mortgage_balance) : 0,
    monthly_payment: body.monthly_payment != null ? Number(body.monthly_payment) : null,
    interest_rate: body.interest_rate != null ? Number(body.interest_rate) : null,
    planned_sale_year: body.planned_sale_year != null ? Number(body.planned_sale_year) : null,
    selling_costs_pct: body.selling_costs_pct != null ? Number(body.selling_costs_pct) : 6,
    is_primary_residence: body.is_primary_residence ?? false,
    years_lived_in: body.years_lived_in != null ? Number(body.years_lived_in) : null,
    titling: body.titling || null,
    situs_state: body.situs_state || null,
    estate_inclusion_status: body.estate_inclusion_status ?? 'included',
    updated_at: new Date().toISOString(),
  }
  if (forInsert) {
    row.owner_id = userId
  }
  return row
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.name || body.current_value == null) {
    return NextResponse.json({ error: 'name and current_value required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('real_estate')
    .insert(buildRealEstateRow(body, user.id, true))
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
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('real_estate')
    .update(buildRealEstateRow(rest, user.id, false))
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

  const { error } = await supabase
    .from('real_estate')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (household?.id) {
    await afterHouseholdWrite(supabase, household.id)
  }

  return NextResponse.json({ success: true })
}

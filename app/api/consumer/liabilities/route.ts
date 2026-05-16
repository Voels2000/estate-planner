import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'

async function touchHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
) {
  await supabase
    .from('households')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', householdId)
}

function fireRecompute(householdId: string) {
  void triggerEstateHealthRecompute(
    householdId,
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, name, balance, monthly_payment, interest_rate, owner } = body

  if (!type || balance == null) {
    return NextResponse.json({ error: 'type and balance required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('liabilities')
    .insert({
      owner_id: user.id,
      owner: owner ?? 'person1',
      type,
      name,
      balance: Number(balance),
      monthly_payment: monthly_payment != null ? Number(monthly_payment) : null,
      interest_rate: interest_rate != null ? Number(interest_rate) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await touchHousehold(supabase, household.id)
  fireRecompute(household.id)

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

  const numberFields = ['balance', 'monthly_payment', 'interest_rate']
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, val] of Object.entries(rest)) {
    if (val === undefined) continue
    updatePayload[key] = numberFields.includes(key) && val != null ? Number(val) : val
  }

  const { data, error } = await supabase
    .from('liabilities')
    .update(updatePayload)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await touchHousehold(supabase, household.id)
  fireRecompute(household.id)

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
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (household?.id) {
    await touchHousehold(supabase, household.id)
    fireRecompute(household.id)
  }

  return NextResponse.json({ success: true })
}

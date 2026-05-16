import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, requireOwnedHouseholdId, resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

function buildExpenseRow(body: Record<string, unknown>) {
  return {
    category: body.category as string,
    name: (body.name as string | null) ?? null,
    owner: (body.owner as string) ?? 'person1',
    amount: Number(body.amount),
    start_year: Number(body.start_year),
    end_year: body.end_year != null ? Number(body.end_year) : null,
    start_month: body.start_month != null ? Number(body.start_month) : null,
    end_month: body.end_month != null ? Number(body.end_month) : null,
    inflation_adjust: body.inflation_adjust ?? true,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.category || body.amount == null || body.start_year == null) {
    return NextResponse.json(
      { error: 'category, amount, and start_year required' },
      { status: 400 },
    )
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response


  const { data, error } = await supabase
    .from('expenses')
    .insert({
      owner_id: user.id,
      ...buildExpenseRow(body),
    })
    .select()
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
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response


  const { data, error } = await supabase
    .from('expenses')
    .update({
      ...buildExpenseRow(rest),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, owned.householdId)

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

  const householdId = await resolveOwnedHouseholdId(supabase, user.id)

  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (householdId) {
    await afterHouseholdWrite(supabase, householdId)
  }

  return NextResponse.json({ success: true })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody, parseHouseholdIdParam } from '@/lib/api/schemas/householdAccess'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseHouseholdIdParam(request.nextUrl.searchParams.get('householdId'))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

  const { data, error } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', parsed.householdId)
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { strategyType, label } = body as { strategyType?: string; label?: string }
  if (!strategyType) {
    return NextResponse.json({ error: 'strategyType required' }, { status: 400 })
  }

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

  const { error } = await supabase
    .from('strategy_configs')
    .upsert(
      {
        household_id: parsed.householdId,
        strategy_type: strategyType,
        label: label ?? null,
        is_active: true,
      },
      { onConflict: 'household_id,strategy_type' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await afterHouseholdWrite(supabase, parsed.householdId)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { strategyType } = body as { strategyType?: string }
  if (!strategyType) {
    return NextResponse.json({ error: 'strategyType required' }, { status: 400 })
  }

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

  const { error } = await supabase
    .from('strategy_configs')
    .update({ is_active: false })
    .eq('household_id', parsed.householdId)
    .eq('strategy_type', strategyType)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await afterHouseholdWrite(supabase, parsed.householdId)
  return NextResponse.json({ success: true })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const householdId = request.nextUrl.searchParams.get('householdId')
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('strategy_configs')
    .select('strategy_type, label')
    .eq('household_id', householdId)
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId, strategyType, label } = await request.json()
  if (!householdId || !strategyType) {
    return NextResponse.json({ error: 'householdId and strategyType required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('strategy_configs')
    .upsert(
      { household_id: householdId, strategy_type: strategyType, label: label ?? null, is_active: true },
      { onConflict: 'household_id,strategy_type' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId, strategyType } = await request.json()
  if (!householdId || !strategyType) {
    return NextResponse.json({ error: 'householdId and strategyType required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('strategy_configs')
    .update({ is_active: false })
    .eq('household_id', householdId)
    .eq('strategy_type', strategyType)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

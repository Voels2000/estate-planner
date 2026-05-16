import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, requireOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const stocks = Number(body.target_stocks_pct)
  const bonds = Number(body.target_bonds_pct)
  const cash = Number(body.target_cash_pct)

  if (![stocks, bonds, cash].every((n) => Number.isFinite(n))) {
    return NextResponse.json(
      { error: 'target_stocks_pct, target_bonds_pct, and target_cash_pct required' },
      { status: 400 },
    )
  }

  const total = stocks + bonds + cash
  if (Math.abs(total - 100) > 0.01) {
    return NextResponse.json({ error: 'Target allocation must sum to 100%' }, { status: 400 })
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const { error } = await supabase
    .from('households')
    .update({
      target_stocks_pct: stocks,
      target_bonds_pct: bonds,
      target_cash_pct: cash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', owned.householdId)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, owned.householdId)

  return NextResponse.json({
    target_stocks_pct: stocks,
    target_bonds_pct: bonds,
    target_cash_pct: cash,
  })
}

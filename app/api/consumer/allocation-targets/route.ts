import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { afterHouseholdWrite, requireOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'

const RISK_TOLERANCE_VALUES = ['conservative', 'moderate', 'aggressive'] as const

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const hasTargets =
    body.target_stocks_pct != null &&
    body.target_bonds_pct != null &&
    body.target_cash_pct != null
  const hasRisk =
    body.risk_tolerance != null &&
    RISK_TOLERANCE_VALUES.includes(body.risk_tolerance)

  if (!hasTargets && !hasRisk) {
    return NextResponse.json(
      { error: 'Provide target allocation and/or risk_tolerance' },
      { status: 400 },
    )
  }

  let stocks: number | undefined
  let bonds: number | undefined
  let cash: number | undefined

  if (hasTargets) {
    stocks = Number(body.target_stocks_pct)
    bonds = Number(body.target_bonds_pct)
    cash = Number(body.target_cash_pct)

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
  }

  if (body.risk_tolerance != null && !hasRisk) {
    return NextResponse.json(
      { error: 'risk_tolerance must be conservative, moderate, or aggressive' },
      { status: 400 },
    )
  }

  const owned = await requireOwnedHouseholdId(supabase, user.id)
  if (!owned.ok) return owned.response

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (hasTargets) {
    updates.target_stocks_pct = stocks
    updates.target_bonds_pct = bonds
    updates.target_cash_pct = cash
  }
  if (hasRisk) {
    updates.risk_tolerance = body.risk_tolerance
  }

  const { error } = await supabase
    .from('households')
    .update(updates)
    .eq('id', owned.householdId)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await afterHouseholdWrite(supabase, owned.householdId)

  return NextResponse.json({
    ...(hasTargets
      ? { target_stocks_pct: stocks, target_bonds_pct: bonds, target_cash_pct: cash }
      : {}),
    ...(hasRisk ? { risk_tolerance: body.risk_tolerance } : {}),
  })
}

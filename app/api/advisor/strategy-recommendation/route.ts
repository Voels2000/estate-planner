/**
 * Advisor strategy recommendation write API.
 *
 * Canonical advisor write path for creating/deactivating advisor-sourced
 * `strategy_line_items` recommendations after advisor-client authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type StrategySource =
  | 'slat' | 'ilit' | 'grat' | 'crt' | 'clat' | 'daf'
  | 'annual_gifting' | 'cst' | 'roth' | 'liquidity' | 'revocable_trust'

function isStrategySource(value: unknown): value is StrategySource {
  if (typeof value !== 'string') return false
  return [
    'slat', 'ilit', 'grat', 'crt', 'clat', 'daf',
    'annual_gifting', 'cst', 'roth', 'liquidity', 'revocable_trust',
  ].includes(value)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    householdId,
    strategySource,
    amount,
    sign = -1,
    confidenceLevel = 'medium',
    scenarioName,
    effectiveYear,
  metadata,
  } = await request.json() as {
    householdId: string
    strategySource: StrategySource
    amount: number
    sign?: number
    confidenceLevel?: 'low' | 'medium' | 'high'
    scenarioName?: string
    effectiveYear?: number
    metadata?: Record<string, unknown>
  }

  if (!householdId || !strategySource || amount == null) {
    return NextResponse.json({ error: 'householdId, strategySource, and amount required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', user.id)
    .eq('client_id', household.owner_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Forbidden — not an active advisor for this client' }, { status: 403 })

  const { data, error } = await supabase
    .from('strategy_line_items')
    .insert({
      household_id: householdId,
      source_role: 'advisor',
      strategy_source: strategySource,
      amount: Math.abs(amount),
      sign,
      confidence_level: confidenceLevel,
      is_active: true,
      effective_year: effectiveYear ?? new Date().getFullYear(),
      advisor_id: user.id,
      consumer_accepted: false,
      consumer_rejected: false,
      scenario_name: scenarioName ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[strategy-recommendation]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ lineItem: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId, strategySource } = await request.json() as {
    householdId?: string
    strategySource?: unknown
  }

  if (!householdId || !isStrategySource(strategySource)) {
    return NextResponse.json({ error: 'householdId and valid strategySource required' }, { status: 400 })
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', user.id)
    .eq('client_id', household.owner_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Forbidden — not an active advisor for this client' }, { status: 403 })

  const { error } = await supabase
    .from('strategy_line_items')
    .update({ is_active: false })
    .eq('household_id', householdId)
    .eq('source_role', 'advisor')
    .eq('strategy_source', strategySource)
    .eq('is_active', true)

  if (error) {
    console.error('[strategy-recommendation:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * Read API for active advisor-sourced `strategy_line_items` on a household.
 *
 * POST `{ householdId }` — advisor-only; verifies `advisor_clients` link before returning rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId } = await request.json()
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  const { data: household } = await supabase
    .from('households')
    .select('owner_id')
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
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('strategy_line_items')
    .select('id, strategy_source, amount, sign, scenario_name, consumer_accepted, consumer_rejected, created_at')
    .eq('household_id', householdId)
    .eq('source_role', 'advisor')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

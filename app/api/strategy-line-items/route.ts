// app/api/strategy-line-items/route.ts
// POST   — upsert a strategy line item
// DELETE — deactivate by household + strategy_source + source_role
// PATCH  — update consumer_status on an active row

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type SourceRole = 'consumer' | 'advisor'

function resolveSourceRole(raw: unknown): SourceRole | null {
  if (raw === undefined || raw === null) return 'consumer'
  if (raw === 'consumer' || raw === 'advisor') return raw
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      household_id, scenario_id, projection_year, metric_target, category,
      strategy_source, amount, sign, confidence_level, effective_year, metadata,
      source_role: sourceRoleRaw,
    } = body

    const source_role = resolveSourceRole(sourceRoleRaw)
    const role = source_role ?? 'consumer'
    if (source_role === null) {
      return NextResponse.json({ error: 'source_role must be consumer or advisor' }, { status: 400 })
    }

    if (!household_id || !strategy_source) {
      return NextResponse.json({ error: 'household_id and strategy_source required' }, { status: 400 })
    }

    // Check if an active row already exists for this household+strategy+role
    const { data: existing } = await supabase
      .from('strategy_line_items')
      .select('id')
      .eq('household_id', household_id)
      .eq('strategy_source', strategy_source)
      .eq('source_role', role)
      .is('projection_year', null)
      .maybeSingle()

    let data, error
    if (existing?.id) {
      // Update existing row
      ;({ data, error } = await supabase
        .from('strategy_line_items')
        .update({
          amount:           amount ?? 0,
          sign:             sign ?? -1,
          confidence_level: confidence_level ?? 'illustrative',
          effective_year:   effective_year ?? null,
          metadata:         metadata ?? {},
          is_active:        true,
        })
        .eq('id', existing.id)
        .select()
        .single())
    } else {
      // Insert new row
      ;({ data, error } = await supabase
        .from('strategy_line_items')
        .insert({
          household_id,
          scenario_id:      scenario_id ?? 'current_law',
          projection_year:  projection_year ?? null,
          metric_target:    metric_target ?? 'taxable_estate',
          category:         category ?? 'other',
          strategy_source,
          source_role:      role,
          amount:           amount ?? 0,
          sign:             sign ?? -1,
          confidence_level: confidence_level ?? 'illustrative',
          effective_year:   effective_year ?? null,
          metadata:         metadata ?? {},
          is_active:        true,
        })
        .select()
        .single())
    }

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { householdId, strategySource, source_role: sourceRoleRaw } = await request.json()
    const source_role = resolveSourceRole(sourceRoleRaw)
    if (source_role === null) {
      return NextResponse.json({ error: 'source_role must be consumer or advisor' }, { status: 400 })
    }

    if (!householdId || !strategySource) {
      return NextResponse.json({ error: 'householdId and strategySource required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('strategy_line_items')
      .update({ is_active: false })
      .eq('household_id', householdId)
      .eq('strategy_source', strategySource)
      .eq('source_role', source_role)
      .eq('is_active', true)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { householdId, strategySource, consumer_status } = await request.json()
    if (!householdId || !strategySource || !consumer_status) {
      return NextResponse.json(
        { error: 'householdId, strategySource, and consumer_status required' },
        { status: 400 },
      )
    }

    const VALID_STATUSES = ['not_started', 'in_progress', 'complete']
    if (!VALID_STATUSES.includes(consumer_status)) {
      return NextResponse.json({ error: 'Invalid consumer_status value' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('strategy_line_items')
      .update({ consumer_status })
      .eq('household_id', householdId)
      .eq('strategy_source', strategySource)
      .eq('is_active', true)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No active row found for that strategy' }, { status: 404 })
    }
    return NextResponse.json(data[0])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}

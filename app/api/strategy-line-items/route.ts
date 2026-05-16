// app/api/strategy-line-items/route.ts
// POST   — upsert a strategy line item
// DELETE — deactivate by household + strategy_source + source_role
// PATCH  — update consumer_status on an active row

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  afterHouseholdWrite,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import { resolveStrategyLineItemCategory } from '@/lib/strategy/resolveStrategyLineItemCategory'

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
      scenario_name,
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

    const resolvedCategory = resolveStrategyLineItemCategory(strategy_source, category)
    if (!resolvedCategory.ok) {
      return NextResponse.json({ error: resolvedCategory.error }, { status: 400 })
    }

    // Build the upsert lookup — scenario_name is part of the key when provided
    // so named scenarios (e.g. "Primary Plan", "Conservative Plan") are distinct rows
    const scenarioNameValue = scenario_name ?? null

    const lookupQuery = supabase
      .from('strategy_line_items')
      .select('id')
      .eq('household_id', household_id)
      .eq('strategy_source', strategy_source)
      .eq('source_role', role)
      .is('projection_year', null)

    // Only include scenario_name in the key when explicitly provided
    // This preserves backward-compat: saves without scenario_name still upsert the
    // single unnamed row for that strategy_source
    const { data: existing } = await (
      scenarioNameValue !== null
        ? lookupQuery.eq('scenario_name', scenarioNameValue)
        : lookupQuery.is('scenario_name', null)
    ).maybeSingle()

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
          scenario_name:    scenarioNameValue,
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
          category:         resolvedCategory.category,
          strategy_source,
          source_role:      role,
          amount:           amount ?? 0,
          sign:             sign ?? -1,
          confidence_level: confidence_level ?? 'illustrative',
          effective_year:   effective_year ?? null,
          metadata:         metadata ?? {},
          scenario_name:    scenarioNameValue,
          is_active:        true,
        })
        .select()
        .single())
    }

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, household_id)
    if (!ownedHouseholdId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await afterHouseholdWrite(supabase, ownedHouseholdId)

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

    const {
      householdId,
      strategySource,
      scenarioName,
      source_role: sourceRoleRaw,
    } = await request.json()
    const source_role = resolveSourceRole(sourceRoleRaw)
    if (source_role === null) {
      return NextResponse.json({ error: 'source_role must be consumer or advisor' }, { status: 400 })
    }

    if (!householdId || !strategySource) {
      return NextResponse.json({ error: 'householdId and strategySource required' }, { status: 400 })
    }

    const baseQuery = supabase
      .from('strategy_line_items')
      .update({ is_active: false })
      .eq('household_id', householdId)
      .eq('strategy_source', strategySource)
      .eq('source_role', source_role)
      .eq('is_active', true)

    // When scenarioName is provided, target only that specific named scenario.
    // When not provided, deactivate all rows for this strategy_source (existing behavior).
    const { error } = await (
      scenarioName != null ? baseQuery.eq('scenario_name', scenarioName) : baseQuery
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, householdId)
    if (ownedHouseholdId) {
      await afterHouseholdWrite(supabase, ownedHouseholdId)
    }

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

    const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, householdId)
    if (ownedHouseholdId) {
      await afterHouseholdWrite(supabase, ownedHouseholdId)
    }

    return NextResponse.json(data[0])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}

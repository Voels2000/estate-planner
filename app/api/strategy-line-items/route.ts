// app/api/strategy-line-items/route.ts
// POST   — upsert a strategy line item
// DELETE — deactivate by household + strategy_source + source_role
// PATCH  — promote / reversal actions by id, or update consumer_status by household + strategy_source

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  afterHouseholdWrite,
  resolveOwnedHouseholdId,
} from '@/lib/consumer/afterHouseholdWrite'
import { resolveStrategyLineItemCategory } from '@/lib/strategy/resolveStrategyLineItemCategory'
import { upsertStrategyLineItem } from '@/lib/strategy/upsertStrategyLineItem'

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

    const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, household_id)
    if (!ownedHouseholdId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedCategory = resolveStrategyLineItemCategory(strategy_source, category)
    if (!resolvedCategory.ok) {
      return NextResponse.json({ error: resolvedCategory.error }, { status: 400 })
    }

    const { data, error } = await upsertStrategyLineItem(supabase, {
      household_id: ownedHouseholdId,
      strategy_source,
      source_role: role,
      category: resolvedCategory.category,
      amount,
      sign,
      confidence_level: confidence_level ?? 'illustrative',
      effective_year,
      metadata,
      scenario_name,
      scenario_id,
      projection_year,
      metric_target,
    })

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
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

    const body = await request.json()
    const { id } = body as { id?: string }

    if (id) {
      const { data: row } = await supabase
        .from('strategy_line_items')
        .select('household_id')
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (!row) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, row.household_id)
      if (!ownedHouseholdId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { error } = await supabase
        .from('strategy_line_items')
        .update({ is_active: false })
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await afterHouseholdWrite(supabase, ownedHouseholdId)
      return NextResponse.json({ success: true })
    }

    const {
      householdId,
      strategySource,
      scenarioName,
      source_role: sourceRoleRaw,
    } = body
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

    const body = await request.json()
    const {
      id,
      action: actionRaw,
      promoteConfidence,
      reversal_reason,
      householdId,
      strategySource,
      consumer_status,
    } = body as {
      id?: string
      action?: string
      promoteConfidence?: boolean
      reversal_reason?: string | null
      householdId?: string
      strategySource?: string
      consumer_status?: string
    }

    const action =
      actionRaw ??
      (promoteConfidence === true ? 'promote' : undefined)

    if (id) {
      const { data: existing, error: fetchError } = await supabase
        .from('strategy_line_items')
        .select(
          'id, confidence_level, household_id, source_role, is_active, consumer_accepted, consumer_withdrawn',
        )
        .eq('id', id)
        .single()

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      if (!existing.is_active && action !== 'withdraw') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const ownedHouseholdId = await resolveOwnedHouseholdId(supabase, user.id, existing.household_id)
      if (!ownedHouseholdId) {
        return NextResponse.json(
          { error: 'Not authorized — only the consumer can modify this strategy' },
          { status: 403 },
        )
      }

      const now = new Date().toISOString()

      if (action === 'promote' || promoteConfidence) {
        if (existing.source_role !== 'consumer') {
          return NextResponse.json(
            { error: 'Use /api/consumer/strategy-recommendation to accept advisor rows' },
            { status: 400 },
          )
        }
        if (existing.confidence_level !== 'illustrative') {
          return NextResponse.json(
            { error: 'Can only promote from illustrative' },
            { status: 400 },
          )
        }
        const { data, error } = await supabase
          .from('strategy_line_items')
          .update({
            confidence_level: 'probable',
            previously_active_at: now,
            is_active: true,
            consumer_withdrawn: false,
            withdrawn_at: null,
          })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await afterHouseholdWrite(supabase, ownedHouseholdId)
        return NextResponse.json(data)
      }

      if (action === 'return_to_sandbox') {
        if (existing.confidence_level !== 'probable') {
          return NextResponse.json(
            { error: 'Can only return probable strategies to sandbox' },
            { status: 400 },
          )
        }
        const { data, error } = await supabase
          .from('strategy_line_items')
          .update({
            confidence_level: 'illustrative',
            consumer_accepted: false,
            is_active: true,
            consumer_withdrawn: false,
            withdrawn_at: null,
          })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await afterHouseholdWrite(supabase, ownedHouseholdId)
        return NextResponse.json(data)
      }

      if (action === 'demote') {
        if (existing.confidence_level !== 'certain') {
          return NextResponse.json(
            { error: 'Can only demote certain strategies' },
            { status: 400 },
          )
        }
        const { data, error } = await supabase
          .from('strategy_line_items')
          .update({
            confidence_level: 'probable',
            reversed_from: 'certain',
            reversal_reason: reversal_reason ?? null,
            is_active: true,
          })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await afterHouseholdWrite(supabase, ownedHouseholdId)
        return NextResponse.json(data)
      }

      if (action === 'withdraw') {
        if (!['probable', 'certain'].includes(existing.confidence_level)) {
          return NextResponse.json(
            { error: 'Can only withdraw probable or certain strategies' },
            { status: 400 },
          )
        }
        const { data, error } = await supabase
          .from('strategy_line_items')
          .update({
            is_active: false,
            consumer_withdrawn: true,
            withdrawn_at: now,
            reversed_from: existing.confidence_level,
            reversal_reason: reversal_reason ?? null,
            consumer_accepted: false,
          })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await afterHouseholdWrite(supabase, ownedHouseholdId)
        return NextResponse.json(data)
      }

      if (consumer_status) {
        const VALID_STATUSES = ['not_started', 'in_progress', 'complete']
        if (!VALID_STATUSES.includes(consumer_status)) {
          return NextResponse.json({ error: 'Invalid consumer_status value' }, { status: 400 })
        }
        const { data, error } = await supabase
          .from('strategy_line_items')
          .update({ consumer_status })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await afterHouseholdWrite(supabase, ownedHouseholdId)
        return NextResponse.json(data)
      }

      return NextResponse.json(
        { error: 'action, promoteConfidence, or consumer_status required' },
        { status: 400 },
      )
    }

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

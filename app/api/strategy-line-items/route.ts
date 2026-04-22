// app/api/strategy-line-items/route.ts
// POST — upsert a strategy line item
// DELETE — deactivate by household + strategy_source

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { household_id, scenario_id, projection_year, metric_target, category,
            strategy_source, amount, sign, confidence_level, effective_year, metadata } = body

    if (!household_id || !strategy_source) {
      return NextResponse.json({ error: 'household_id and strategy_source required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('strategy_line_items')
      .upsert({
        household_id,
        scenario_id:      scenario_id ?? 'current_law',
        projection_year:  projection_year ?? null,
        metric_target:    metric_target ?? 'taxable_estate',
        category:         category ?? 'other',
        strategy_source:  strategy_source,
        amount:           amount ?? 0,
        sign:             sign ?? -1,
        confidence_level: confidence_level ?? 'illustrative',
        effective_year:   effective_year ?? null,
        metadata:         metadata ?? {},
        is_active:        true,
      }, {
        onConflict: 'household_id,strategy_source,projection_year',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { householdId, strategySource } = await request.json()
    if (!householdId || !strategySource) {
      return NextResponse.json({ error: 'householdId and strategySource required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('strategy_line_items')
      .update({ is_active: false })
      .eq('household_id', householdId)
      .eq('strategy_source', strategySource)
      .eq('is_active', true)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 })
  }
}

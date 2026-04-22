// lib/estate/strategyLedger.ts
// CRUD helpers for the strategy_line_items table.
// Called by StrategyOverlay when an advisor marks a strategy as recommended.
// The calculate_estate_composition RPC reads these rows to populate the
// outside_strategy bucket in EstateCompositionCard.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StrategyLineItem, StrategyLineItemInput } from './types'

/**
 * Create or update a strategy line item.
 * Uses upsert on (household_id, strategy_source, projection_year)
 * so re-marking a strategy updates the amount rather than creating a duplicate.
 */
export async function upsertStrategyLineItem(
  supabase: SupabaseClient,
  input: StrategyLineItemInput,
): Promise<{ data: StrategyLineItem | null; error: string | null }> {
  const row = {
    household_id:     input.household_id,
    scenario_id:      input.scenario_id ?? 'current_law',
    projection_year:  input.projection_year ?? null,
    metric_target:    input.metric_target,
    category:         input.category,
    strategy_source:  input.strategy_source,
    amount:           input.amount,
    sign:             input.sign ?? -1,
    confidence_level: input.confidence_level ?? 'illustrative',
    effective_year:   input.effective_year ?? null,
    metadata:         input.metadata ?? {},
    is_active:        true,
  }

  const { data, error } = await supabase
    .from('strategy_line_items')
    .upsert(row, {
      onConflict: 'household_id,strategy_source,projection_year',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[upsertStrategyLineItem] error:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StrategyLineItem, error: null }
}

/**
 * Soft-delete a strategy line item by setting is_active = false.
 * Preserves history — hard delete is rarely needed.
 */
export async function deactivateStrategyLineItem(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('strategy_line_items')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('[deactivateStrategyLineItem] error:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Deactivate all line items for a household + strategy_source combination.
 * Called when an advisor un-marks a strategy as recommended.
 */
export async function deactivateByStrategySource(
  supabase: SupabaseClient,
  householdId: string,
  strategySource: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('strategy_line_items')
    .update({ is_active: false })
    .eq('household_id', householdId)
    .eq('strategy_source', strategySource)
    .eq('is_active', true)

  if (error) {
    console.error('[deactivateByStrategySource] error:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Fetch all active line items for a household (current snapshot only).
 * Used by EstateCompositionCard for the outside_strategy breakdown.
 */
export async function getActiveLineItems(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: StrategyLineItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('strategy_line_items')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .is('projection_year', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getActiveLineItems] error:', error.message)
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as StrategyLineItem[], error: null }
}

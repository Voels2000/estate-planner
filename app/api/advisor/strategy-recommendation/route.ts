/**
 * Advisor strategy recommendation write API.
 *
 * Canonical advisor write path for creating/deactivating advisor-sourced
 * `strategy_line_items` recommendations after advisor-client authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { afterHouseholdWrite } from '@/lib/consumer/afterHouseholdWrite'
import { resolveStrategyLineItemCategory } from '@/lib/strategy/resolveStrategyLineItemCategory'
import {
  isAllowedStrategySource,
  mapAdvisorConfidenceLevel,
  upsertStrategyLineItem,
} from '@/lib/strategy/upsertStrategyLineItem'

async function verifyAdvisorAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  advisorId: string,
  householdId: string,
) {
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single()
  if (!household) return { ok: false as const, status: 404, error: 'Household not found' }

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .eq('client_id', household.owner_id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()
  if (!link) {
    return {
      ok: false as const,
      status: 403,
      error: 'Forbidden — not an active advisor for this client',
    }
  }

  return { ok: true as const, householdId: household.id }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    householdId?: string
    strategySource?: string
    amount?: number
    sign?: number
    confidenceLevel?: string
    scenarioName?: string | null
    effectiveYear?: number
    metadata?: Record<string, unknown>
    category?: string | null
    metric_target?: string
    scenario_id?: string
  }

  const { householdId, strategySource, amount } = body

  if (!householdId || !strategySource || amount == null) {
    return NextResponse.json({ error: 'householdId, strategySource, and amount required' }, { status: 400 })
  }

  if (!isAllowedStrategySource(strategySource)) {
    return NextResponse.json({ error: 'Invalid strategySource' }, { status: 400 })
  }

  const access = await verifyAdvisorAccess(supabase, user.id, householdId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const resolvedCategory = resolveStrategyLineItemCategory(strategySource, body.category)
  if (!resolvedCategory.ok) {
    return NextResponse.json({ error: resolvedCategory.error }, { status: 400 })
  }

  const metricTargetRaw = body.metric_target
  const metricTarget =
    metricTargetRaw === 'gross_estate' ||
    metricTargetRaw === 'net_estate' ||
    metricTargetRaw === 'taxable_estate'
      ? metricTargetRaw
      : undefined
  if (metricTargetRaw && !metricTarget) {
    return NextResponse.json({ error: 'Invalid metric_target' }, { status: 400 })
  }

  const { data, error } = await upsertStrategyLineItem(supabase, {
    household_id: access.householdId,
    strategy_source: strategySource,
    source_role: 'advisor',
    category: resolvedCategory.category,
    amount: Math.abs(amount),
    sign: body.sign ?? -1,
    confidence_level: mapAdvisorConfidenceLevel(body.confidenceLevel),
    effective_year: body.effectiveYear ?? new Date().getFullYear(),
    metadata: body.metadata ?? {},
    scenario_name: body.scenarioName ?? null,
    scenario_id: body.scenario_id,
    metric_target: metricTarget,
    advisor_id: user.id,
  })

  if (error) {
    console.error('[strategy-recommendation]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json({ lineItem: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    householdId?: string
    strategySource?: string
    scenarioName?: string | null
  }

  const { householdId, strategySource } = body

  if (!householdId || !strategySource || !isAllowedStrategySource(strategySource)) {
    return NextResponse.json({ error: 'householdId and valid strategySource required' }, { status: 400 })
  }

  const access = await verifyAdvisorAccess(supabase, user.id, householdId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const baseQuery = supabase
    .from('strategy_line_items')
    .update({ is_active: false })
    .eq('household_id', access.householdId)
    .eq('strategy_source', strategySource)
    .eq('source_role', 'advisor')
    .eq('is_active', true)

  const { error } = await (
    body.scenarioName != null
      ? baseQuery.eq('scenario_name', body.scenarioName)
      : baseQuery
  )

  if (error) {
    console.error('[strategy-recommendation:delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await afterHouseholdWrite(supabase, access.householdId)

  return NextResponse.json({ success: true })
}

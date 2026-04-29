/**
 * Advisor Monte Carlo assumptions management API.
 *
 * Supports advisor CRUD + activation/share operations for
 * `advisor_projection_assumptions` rows tied to a client household.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'

async function assertAdvisorAccess(supabase: Awaited<ReturnType<typeof createClient>>, advisorId: string, clientHouseholdId: string) {
  const { data: household } = await supabase
    .from('households')
    .select('owner_id')
    .eq('id', clientHouseholdId)
    .single()
  if (!household) return false

  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', advisorId)
    .eq('client_id', household.owner_id)
    .eq('status', 'active')
    .maybeSingle()

  return !!link
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientHouseholdId = request.nextUrl.searchParams.get('clientHouseholdId')
  if (!clientHouseholdId) return NextResponse.json({ error: 'clientHouseholdId required' }, { status: 400 })

  const ok = await assertAdvisorAccess(supabase, user.id, clientHouseholdId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: scenarios, error } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('advisor_id', user.id)
    .eq('client_household_id', clientHouseholdId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: presets } = await supabase
    .from('advisor_projection_assumptions')
    .select('*')
    .eq('advisor_id', user.id)
    .eq('is_preset', true)
    .order('scenario_name', { ascending: true })

  return NextResponse.json({
    scenarios: scenarios ?? [],
    presets: presets ?? [],
    systemDefaults: MONTE_CARLO_SYSTEM_DEFAULTS,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    clientHouseholdId,
    scenarioName,
    isPreset = false,
    returnMeanPct,
    volatilityPct,
    withdrawalRatePct,
    successThreshold,
    simulationCount,
    planningHorizonYr,
    inflationRatePct,
    notes,
  } = body

  if (!scenarioName) return NextResponse.json({ error: 'scenarioName required' }, { status: 400 })
  if (!isPreset && !clientHouseholdId) {
    return NextResponse.json({ error: 'clientHouseholdId required for non-preset scenarios' }, { status: 400 })
  }
  if (!isPreset) {
    const ok = await assertAdvisorAccess(supabase, user.id, clientHouseholdId)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rangeErrors: string[] = []
  if (returnMeanPct != null && (returnMeanPct < 2.0 || returnMeanPct > 12.0)) rangeErrors.push('returnMeanPct must be 2–12')
  if (volatilityPct != null && (volatilityPct < 5.0 || volatilityPct > 25.0)) rangeErrors.push('volatilityPct must be 5–25')
  if (withdrawalRatePct != null && (withdrawalRatePct < 1.0 || withdrawalRatePct > 8.0)) rangeErrors.push('withdrawalRatePct must be 1–8')
  if (successThreshold != null && (successThreshold < 50.0 || successThreshold > 99.0)) rangeErrors.push('successThreshold must be 50–99')
  if (simulationCount != null && (simulationCount < 500 || simulationCount > 10000)) rangeErrors.push('simulationCount must be 500–10000')
  if (planningHorizonYr != null && (planningHorizonYr < 10 || planningHorizonYr > 50)) rangeErrors.push('planningHorizonYr must be 10–50')
  if (inflationRatePct != null && (inflationRatePct < 1.0 || inflationRatePct > 6.0)) rangeErrors.push('inflationRatePct must be 1–6')
  if (returnMeanPct != null && inflationRatePct != null && returnMeanPct - inflationRatePct <= 0) {
    rangeErrors.push('Real return (returnMean − inflation) must be positive')
  }
  if (rangeErrors.length > 0) return NextResponse.json({ error: rangeErrors.join('; ') }, { status: 422 })

  const { data, error } = await supabase
    .from('advisor_projection_assumptions')
    .upsert({
      advisor_id: user.id,
      client_household_id: isPreset ? null : clientHouseholdId,
      scenario_name: scenarioName,
      is_preset: isPreset,
      return_mean_pct: returnMeanPct ?? null,
      volatility_pct: volatilityPct ?? null,
      withdrawal_rate_pct: withdrawalRatePct ?? null,
      success_threshold: successThreshold ?? null,
      simulation_count: simulationCount ?? null,
      planning_horizon_yr: planningHorizonYr ?? null,
      inflation_rate_pct: inflationRatePct ?? null,
      notes: notes ?? null,
    }, {
      onConflict: 'advisor_id,client_household_id,scenario_name',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenario: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await request.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('advisor_projection_assumptions')
    .select('id, client_household_id')
    .eq('id', id)
    .eq('advisor_id', user.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'activate') {
    await supabase
      .from('advisor_projection_assumptions')
      .update({ is_active: false })
      .eq('advisor_id', user.id)
      .eq('client_household_id', existing.client_household_id)
    const { data, error } = await supabase
      .from('advisor_projection_assumptions')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ scenario: data })
  }

  if (action === 'share') {
    const { data, error } = await supabase
      .from('advisor_projection_assumptions')
      .update({ shared_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ scenario: data })
  }

  if (action === 'deactivate') {
    const { data, error } = await supabase
      .from('advisor_projection_assumptions')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ scenario: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('advisor_projection_assumptions')
    .delete()
    .eq('id', id)
    .eq('advisor_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

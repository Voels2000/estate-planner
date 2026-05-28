import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MONTE_CARLO_SYSTEM_DEFAULTS } from '@/lib/calculations/monteCarlo'
import { loadMonteCarloAdvisorAssumptions } from '@/lib/monte-carlo/loadMonteCarloAdvisorAssumptions'

function mapAssumptions(row: Record<string, unknown>) {
  return {
    returnMeanPct: Number(row.return_mean_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.returnMeanPct),
    volatilityPct: Number(row.volatility_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.volatilityPct),
    withdrawalRatePct: Number(
      row.withdrawal_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.withdrawalRatePct,
    ),
    successThreshold: Number(
      row.success_threshold ?? MONTE_CARLO_SYSTEM_DEFAULTS.successThreshold,
    ),
    simulationCount: Number(
      row.simulation_count ?? MONTE_CARLO_SYSTEM_DEFAULTS.simulationCount,
    ),
    planningHorizonYr: Number(
      row.planning_horizon_yr ?? MONTE_CARLO_SYSTEM_DEFAULTS.planningHorizonYr,
    ),
    inflationRatePct: Number(
      row.inflation_rate_pct ?? MONTE_CARLO_SYSTEM_DEFAULTS.inflationRatePct,
    ),
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  const data = await loadMonteCarloAdvisorAssumptions(supabase, user.id)
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, scenarioId } = await request.json() as {
    action?: 'accept' | 'revert'
    scenarioId?: string
  }
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 })

  if (action === 'accept') {
    if (!scenarioId) return NextResponse.json({ error: 'scenarioId required for accept' }, { status: 400 })

    await supabase
      .from('advisor_projection_assumptions')
      .update({ accepted_by_client: false, accepted_at: null })
      .eq('client_household_id', household.id)
      .eq('accepted_by_client', true)

    const { data: accepted, error } = await supabase
      .from('advisor_projection_assumptions')
      .update({ accepted_by_client: true, accepted_at: new Date().toISOString() })
      .eq('id', scenarioId)
      .eq('client_household_id', household.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      acceptedScenario: {
        id: accepted.id,
        scenarioName: accepted.scenario_name,
        acceptedAt: accepted.accepted_at,
        assumptions: mapAssumptions(accepted as Record<string, unknown>),
      },
    })
  }

  if (action === 'revert') {
    const { error } = await supabase
      .from('advisor_projection_assumptions')
      .update({ accepted_by_client: false, accepted_at: null })
      .eq('client_household_id', household.id)
      .eq('accepted_by_client', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ reverted: true, systemDefaults: MONTE_CARLO_SYSTEM_DEFAULTS })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

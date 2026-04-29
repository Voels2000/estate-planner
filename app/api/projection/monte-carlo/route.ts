/**
 * Advisor Monte Carlo run API.
 *
 * POST runs a Monte Carlo simulation for an advisor-linked household using merged
 * system-default and request-provided assumption overrides.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runMonteCarloSimulation,
  MONTE_CARLO_SYSTEM_DEFAULTS,
  type MonteCarloAssumptions,
} from '@/lib/calculations/monteCarlo'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { householdId, grossEstate, assumptions } = (await request.json()) as {
    householdId: string
    grossEstate: number
    assumptions?: Partial<MonteCarloAssumptions>
  }
  if (!householdId || grossEstate == null) {
    return NextResponse.json({ error: 'householdId and grossEstate required' }, { status: 400 })
  }

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

  const mergedAssumptions: MonteCarloAssumptions = {
    ...MONTE_CARLO_SYSTEM_DEFAULTS,
    ...(assumptions ?? {}),
  }

  try {
    const result = runMonteCarloSimulation(
      {
        portfolioValue: Math.max(0, Number(grossEstate ?? 0)),
        annualSpend: 0,
        annualIncome: 0,
      },
      mergedAssumptions,
    )

    return NextResponse.json({
      successRate: result.successRate,
      medianEndValue: result.medianEndingValue,
      p10EndValue: result.p10EndingValue,
      p90EndValue: result.p90EndingValue,
    })
  } catch (err) {
    console.error('[projection/monte-carlo]', err)
    return NextResponse.json({ error: 'Simulation error' }, { status: 500 })
  }
}

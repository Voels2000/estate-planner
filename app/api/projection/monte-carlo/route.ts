import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runMonteCarloSimulation,
  MONTE_CARLO_SYSTEM_DEFAULTS,
  type MonteCarloAssumptions,
} from '@/lib/calculations/monteCarlo'
import { requireHouseholdAccess } from '@/lib/api/assertHouseholdAccess'
import { parseHouseholdIdBody } from '@/lib/api/schemas/householdAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = parseHouseholdIdBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { grossEstate, assumptions } = body as {
    grossEstate?: number
    assumptions?: Partial<MonteCarloAssumptions>
  }
  if (grossEstate == null) {
    return NextResponse.json({ error: 'grossEstate required' }, { status: 400 })
  }

  const access = await requireHouseholdAccess(supabase, user.id, parsed.householdId)
  if (!access.ok) return access.response

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

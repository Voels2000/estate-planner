import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserAccess } from '@/lib/get-user-access'
import { runSimulation, MonteCarloInputs } from '@/lib/monte-carlo'

export async function GET() {
  const access = await getUserAccess()
  if (access.tier < 3) {
    return NextResponse.json({ error: 'Tier 3 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('monte_carlo_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const access = await getUserAccess()
  if (access.tier < 3) {
    return NextResponse.json({ error: 'Tier 3 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const inputs: MonteCarloInputs = {
    current_age:                body.current_age,
    retirement_age:             body.retirement_age,
    life_expectancy:            body.life_expectancy ?? 90,
    current_portfolio:          body.current_portfolio,
    monthly_contribution:       body.monthly_contribution ?? 0,
    stocks_pct:                 body.stocks_pct ?? 70,
    bonds_pct:                  body.bonds_pct ?? 20,
    cash_pct:                   body.cash_pct ?? 10,
    annual_spending:            body.annual_spending,
    social_security_monthly:    body.social_security_monthly ?? 0,
    social_security_start_age:  body.social_security_start_age ?? 67,
    other_income_annual:        body.other_income_annual ?? 0,
    inflation_rate:             body.inflation_rate ?? 2.5,
    simulation_count:           body.simulation_count ?? 1000,
    include_rmd:                body.include_rmd ?? true,
  }

  const result = runSimulation(inputs)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('monte_carlo_runs')
    .insert({
      user_id:                  user.id,
      ...inputs,
      ...result,
      percentile_10:            result.percentile_10,
      percentile_25:            result.percentile_25,
      percentile_50:            result.percentile_50,
      percentile_75:            result.percentile_75,
      percentile_90:            result.percentile_90,
      label:                    body.label ?? null,
      notes:                    body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

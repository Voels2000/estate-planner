import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'

const INVESTABLE_TYPES = ['brokerage', '401k', 'ira', 'roth', 'savings', 'cash', 'other', 'bank', 'hsa']

function assetClass(type: string): 'stocks' | 'bonds' | 'cash' | 'other' {
  const t = type.toLowerCase()
  if (['brokerage', '401k', 'ira', 'roth', 'hsa'].includes(t)) return 'stocks'
  if (['savings', 'cash', 'bank'].includes(t))                  return 'cash'
  return 'other'
}

function recommendedAllocation(age: number, risk: string): { stocks: number; bonds: number; cash: number } {
  const base =
    risk === 'conservative' ? Math.max(20, 110 - age) :
    risk === 'aggressive'   ? Math.max(40, 130 - age) :
                              Math.max(30, 120 - age)
  const stocks = Math.min(base, risk === 'aggressive' ? 95 : risk === 'conservative' ? 70 : 85)
  const cash   = risk === 'conservative' ? 10 : 5
  const bonds  = Math.max(0, 100 - stocks - cash)
  return { stocks, bonds, cash }
}

export async function GET() {
  const access = await getUserAccess()
  if (access.tier < 2) {
    return NextResponse.json({ error: 'Tier 2 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentYear = new Date().getFullYear()

  const [
    { data: household },
    { data: assets },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('households')
      .select('person1_first_name, person1_birth_year, person1_retirement_age, has_spouse, person2_first_name, person2_birth_year, risk_tolerance')
      .eq('owner_id', user.id)
      .single(),
    supabase
      .from('assets')
      .select('type, value, name')
      .eq('owner_id', user.id),
    supabase
      .from('expenses')
      .select('amount, start_year, end_year')
      .eq('owner_id', user.id),
  ])

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const age = household.person1_birth_year
    ? currentYear - household.person1_birth_year
    : null

  const risk = household.risk_tolerance ?? 'moderate'

  const investable = (assets ?? []).filter(a =>
    INVESTABLE_TYPES.some(t => a.type?.toLowerCase().includes(t))
  )

  const current = { stocks: 0, bonds: 0, cash: 0, other: 0 }
  for (const a of investable) {
    current[assetClass(a.type)] += a.value ?? 0
  }
  const totalPortfolio = current.stocks + current.bonds + current.cash + current.other

  const currentPct = totalPortfolio > 0 ? {
    stocks: Math.round((current.stocks / totalPortfolio) * 100),
    bonds:  Math.round((current.bonds  / totalPortfolio) * 100),
    cash:   Math.round((current.cash   / totalPortfolio) * 100),
    other:  Math.round((current.other  / totalPortfolio) * 100),
  } : { stocks: 0, bonds: 0, cash: 0, other: 0 }

  const recommended = age ? recommendedAllocation(age, risk) : null

  const drift = recommended ? {
    stocks: currentPct.stocks - recommended.stocks,
    bonds:  currentPct.bonds  - recommended.bonds,
    cash:   currentPct.cash   - recommended.cash,
  } : null

  const rebalance = (recommended && totalPortfolio > 0) ? {
    stocks: Math.round((recommended.stocks / 100) * totalPortfolio) - current.stocks,
    bonds:  Math.round((recommended.bonds  / 100) * totalPortfolio) - current.bonds,
    cash:   Math.round((recommended.cash   / 100) * totalPortfolio) - current.cash,
  } : null

  const annual_spending = (expenses ?? [])
    .filter(e => {
      const start = e.start_year ?? 0
      const end   = e.end_year   ?? 9999
      return currentYear >= start && currentYear <= end
    })
    .reduce((sum, e) => sum + (e.amount ?? 0), 0)

  const withdrawal_rate = (totalPortfolio > 0 && annual_spending > 0)
    ? Math.round((annual_spending / totalPortfolio) * 1000) / 10
    : null

  const breakdown = investable.map(a => ({
    name:        a.name,
    type:        a.type,
    value:       a.value ?? 0,
    asset_class: assetClass(a.type),
    pct:         totalPortfolio > 0 ? Math.round(((a.value ?? 0) / totalPortfolio) * 1000) / 10 : 0,
  }))

  return NextResponse.json({
    person1_first_name: household.person1_first_name,
    age,
    risk,
    total_portfolio:  totalPortfolio,
    annual_spending,
    withdrawal_rate,
    current_amounts:  current,
    current_pct:      currentPct,
    recommended,
    drift,
    rebalance,
    breakdown,
    has_assets: investable.length > 0,
  })
}
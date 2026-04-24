import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'

function assetClass(type: string): 'stocks' | 'bonds' | 'cash' | 'other' {
  const t = type.toLowerCase()
  if (t.includes('brokerage') || t.includes('401k') || t.includes('ira') || t.includes('roth') || t === 'hsa') return 'stocks'
  if (t.includes('bank') || t.includes('savings') || t.includes('cash'))                                       return 'cash'
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
      .select('person1_first_name, person1_birth_year, person1_retirement_age, has_spouse, person2_first_name, person2_birth_year, risk_tolerance, target_stocks_pct, target_bonds_pct, target_cash_pct')
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

  const investable = (assets ?? []).filter(a => a.type?.toLowerCase() !== 'life_insurance')

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

  const ageBasedTarget = age ? recommendedAllocation(age, risk) : null

  // Use saved target mix if set, otherwise fall back to age/risk formula
  const hasTargetMix = household.target_stocks_pct != null
  const recommended = hasTargetMix
    ? { stocks: household.target_stocks_pct!, bonds: household.target_bonds_pct!, cash: household.target_cash_pct! }
    : ageBasedTarget

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

  // All three benchmark models for the unified page
  const retirementYear = household.person1_birth_year
    ? household.person1_birth_year + (household.person1_retirement_age ?? 65)
    : null
  const yearsToRetirement = retirementYear ? Math.max(0, retirementYear - currentYear) : null
  const ageBenchmark = age ? recommendedAllocation(age, risk) : null
  const riskBenchmark = {
    conservative:  { stocks: 30, bonds: 60, cash: 10 },
    moderate:      { stocks: 60, bonds: 35, cash: 5  },
    aggressive:    { stocks: 85, bonds: 12, cash: 3  },
  }[risk as string] ?? { stocks: 60, bonds: 35, cash: 5 }
  const targetDateBenchmark = yearsToRetirement != null ? (
    yearsToRetirement >= 30 ? { stocks: 90, bonds: 8,  cash: 2  } :
    yearsToRetirement >= 20 ? { stocks: 80, bonds: 17, cash: 3  } :
    yearsToRetirement >= 10 ? { stocks: 65, bonds: 30, cash: 5  } :
    yearsToRetirement >= 5  ? { stocks: 50, bonds: 42, cash: 8  } :
                               { stocks: 35, bonds: 52, cash: 13 }
  ) : null

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
    retirement_year:   retirementYear,
    years_to_retirement: yearsToRetirement,
    total_portfolio:   totalPortfolio,
    annual_spending,
    withdrawal_rate,
    current_amounts:   current,
    current_pct:       currentPct,
    target_mix:        hasTargetMix ? recommended : null,
    target_mix_source: hasTargetMix ? 'saved' : 'formula',
    recommended,
    drift,
    rebalance,
    benchmarks: {
      age_based:   ageBenchmark,
      risk_based:  riskBenchmark,
      target_date: targetDateBenchmark,
    },
    breakdown,
    has_assets: investable.length > 0,
  })
}
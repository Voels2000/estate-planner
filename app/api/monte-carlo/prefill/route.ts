import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserAccess } from '@/lib/get-user-access'

/** Income rows that represent salary / earned income — excluded from "other" retirement income prefill. */
const EARNED_INCOME_SOURCES = new Set(['salary', 'employment', 'self_employment'])

function isActiveForYear(
  startYear: number | null | undefined,
  endYear: number | null | undefined,
  year: number
): boolean {
  if (startYear != null && startYear > year) return false
  if (endYear != null && endYear < year) return false
  return true
}

/** Sum of retirement-account assets only (tax-advantaged retirement savings), per asset `type`. */
function sumRetirementAccountValue(
  rows: { type: string | null | undefined; value: number | null | undefined }[] | null | undefined
): number | null {
  if (!rows?.length) return null
  let sum = 0
  let any = false
  for (const a of rows) {
    const t = (a.type ?? '').toLowerCase()
    if (!t) continue
    if (t === 'retirement_account') {
      sum += Number(a.value ?? 0)
      any = true
      continue
    }
    if (['traditional_401k', 'roth_ira', 'traditional_ira'].includes(t)) {
      sum += Number(a.value ?? 0)
      any = true
      continue
    }
    if (/(401k|403b|457|ira|roth|hsa|sep|simple|retirement)/.test(t) && !t.includes('brokerage')) {
      sum += Number(a.value ?? 0)
      any = true
    }
  }
  return any ? sum : null
}

export async function GET() {
  const access = await getUserAccess()
  if (access.tier < 3) {
    return NextResponse.json({ error: 'Tier 3 required' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [
    { data: household },
    { data: assets },
    { data: income },
    { data: expenses },
  ] = await Promise.all([
    admin
      .from('households')
      .select(
        'person1_name, person1_birth_year, person1_retirement_age, person1_longevity_age, person1_ss_benefit_67, person1_ss_claiming_age, person2_name, person2_birth_year, person2_retirement_age, person2_longevity_age, person2_ss_benefit_67, person2_ss_claiming_age, has_spouse, inflation_rate, growth_rate_accumulation, risk_tolerance, target_stocks_pct, target_bonds_pct, target_cash_pct'
      )
      .eq('owner_id', user.id)
      .single(),
    admin.from('assets').select('type, value').eq('owner_id', user.id),
    admin.from('income').select('source, amount, ss_person, start_year, end_year').eq('owner_id', user.id),
    admin.from('expenses').select('amount, start_year, end_year').eq('owner_id', user.id),
  ])

  const currentYear = new Date().getFullYear()

  const activeIncome = (income ?? []).filter(i => isActiveForYear(i.start_year, i.end_year, currentYear))
  const activeExpenses = (expenses ?? []).filter(e => isActiveForYear(e.start_year, e.end_year, currentYear))

  // Person 1
  const birth_year = household?.person1_birth_year ?? null
  const current_age = birth_year ? currentYear - birth_year : null
  const retirement_age = household?.person1_retirement_age ?? null
  const life_expectancy = household?.person1_longevity_age ?? null
  const inflation_rate = household?.inflation_rate ?? null
  const social_security_start_age = household?.person1_ss_claiming_age ?? null
  const social_security_monthly = household?.person1_ss_benefit_67 ?? null

  // Person 2
  const has_spouse = household?.has_spouse ?? false
  const p2_birth_year = household?.person2_birth_year ?? null
  const p2_current_age = p2_birth_year ? currentYear - p2_birth_year : null
  const p2_retirement_age = household?.person2_retirement_age ?? null
  const p2_life_expectancy = household?.person2_longevity_age ?? null
  const p2_social_security_start_age = household?.person2_ss_claiming_age ?? null
  const p2_social_security_monthly = household?.person2_ss_benefit_67 ?? null

  // Portfolio — retirement accounts only (current savings estimate)
  const current_portfolio = sumRetirementAccountValue(assets ?? [])

  // Income — active rows: total for surplus; "other" excludes earned + social_security
  const current_income_annual =
    activeIncome.length > 0
      ? activeIncome.reduce((sum, i) => sum + Number(i.amount ?? 0), 0)
      : null

  const p1SSIncome =
    activeIncome.filter(i => i.ss_person === 'person1').reduce((sum, i) => sum + Number(i.amount ?? 0), 0) ?? 0
  const p2SSIncome =
    activeIncome.filter(i => i.ss_person === 'person2').reduce((sum, i) => sum + Number(i.amount ?? 0), 0) ?? 0

  const other_income_annual =
    activeIncome.length > 0
      ? (() => {
          const sum = activeIncome
            .filter(i => {
              if (i.ss_person) return false
              if (i.source === 'social_security') return false
              return !EARNED_INCOME_SOURCES.has((i.source ?? '').toLowerCase())
            })
            .reduce((s, i) => s + Number(i.amount ?? 0), 0)
          return sum > 0 ? sum : null
        })()
      : null

  const ss_monthly = social_security_monthly ?? (p1SSIncome > 0 ? Math.round(p1SSIncome / 12) : null)
  const p2_ss_monthly = p2_social_security_monthly ?? (p2SSIncome > 0 ? Math.round(p2SSIncome / 12) : null)

  // Expenses — active rows, amounts stored as annual in the app
  const annual_spending =
    activeExpenses.length > 0
      ? activeExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
      : null

  // Estimated monthly savings from cash-flow surplus (editable in the form)
  let monthly_contribution: number | null = null
  let monthlyContributionSource: 'surplus' | 'none' = 'none'
  if (current_income_annual != null && annual_spending != null) {
    monthly_contribution = Math.max(0, Math.round((current_income_annual - annual_spending) / 12))
    monthlyContributionSource = 'surplus'
  }

  // Allocation: target mix → growth_rate_accumulation → risk_tolerance
  let stocks_pct: number | null = null
  let bonds_pct: number | null = null
  let cash_pct: number | null = null
  let allocationSource: 'target_mix' | 'growth_rate' | 'risk_tolerance' | 'missing' = 'missing'

  if (household?.target_stocks_pct != null) {
    stocks_pct = household.target_stocks_pct
    bonds_pct = household.target_bonds_pct ?? null
    cash_pct = household.target_cash_pct ?? null
    allocationSource = 'target_mix'
  } else if (household?.growth_rate_accumulation != null && household.growth_rate_accumulation !== undefined) {
    const g = Number(household.growth_rate_accumulation)
    if (g >= 8) stocks_pct = 80
    else if (g >= 6) stocks_pct = 70
    else if (g >= 4) stocks_pct = 55
    else stocks_pct = 40
    if (g >= 8) {
      bonds_pct = 15
      cash_pct = 5
    } else if (g >= 6) {
      bonds_pct = 20
      cash_pct = 10
    } else if (g >= 4) {
      bonds_pct = 35
      cash_pct = 10
    } else {
      bonds_pct = 45
      cash_pct = 15
    }
    allocationSource = 'growth_rate'
  } else if (household?.risk_tolerance) {
    const r = String(household.risk_tolerance).toLowerCase()
    if (r === 'conservative') {
      stocks_pct = 30
      bonds_pct = 60
      cash_pct = 10
    } else if (r === 'aggressive') {
      stocks_pct = 85
      bonds_pct = 12
      cash_pct = 3
    } else {
      stocks_pct = 60
      bonds_pct = 35
      cash_pct = 5
    }
    allocationSource = 'risk_tolerance'
  }

  const allocationConfidence =
    allocationSource === 'target_mix' ? 'profile' : allocationSource === 'missing' ? 'missing' : 'estimated'

  const confidence: Record<string, string> = {
    current_age: current_age !== null ? 'profile' : 'missing',
    retirement_age: retirement_age !== null ? 'profile' : 'missing',
    life_expectancy: life_expectancy !== null ? 'profile' : 'missing',
    inflation_rate: inflation_rate !== null ? 'profile' : 'missing',
    social_security_monthly: ss_monthly !== null ? 'profile' : 'missing',
    social_security_start_age: social_security_start_age !== null ? 'profile' : 'missing',
    current_portfolio: current_portfolio !== null && current_portfolio > 0 ? 'profile' : 'missing',
    monthly_contribution:
      monthlyContributionSource === 'surplus' ? 'estimated' : 'missing',
    stocks_pct: allocationConfidence,
    bonds_pct: allocationConfidence,
    cash_pct: allocationConfidence,
    other_income_annual:
      other_income_annual !== null && other_income_annual > 0 ? 'profile' : 'missing',
    annual_spending: annual_spending !== null && annual_spending > 0 ? 'profile' : 'missing',
    p2_current_age: has_spouse && p2_current_age !== null ? 'profile' : has_spouse ? 'missing' : 'estimated',
    p2_retirement_age: has_spouse && p2_retirement_age !== null ? 'profile' : has_spouse ? 'missing' : 'estimated',
    p2_life_expectancy: has_spouse && p2_life_expectancy !== null ? 'profile' : has_spouse ? 'missing' : 'estimated',
    p2_social_security_monthly: has_spouse && p2_ss_monthly !== null ? 'profile' : has_spouse ? 'missing' : 'estimated',
    p2_social_security_start_age:
      has_spouse && p2_social_security_start_age !== null ? 'profile' : has_spouse ? 'missing' : 'estimated',
  }

  const profileCount = Object.values(confidence).filter(v => v === 'profile').length
  const estimatedCount = Object.values(confidence).filter(v => v === 'estimated').length
  const missingCount = Object.values(confidence).filter(v => v === 'missing').length

  return NextResponse.json({
    person1_name: household?.person1_name ?? null,
    person2_name: household?.person2_name ?? null,
    prefill: {
      birth_year,
      current_age,
      retirement_age,
      life_expectancy,
      inflation_rate,
      social_security_monthly: ss_monthly,
      social_security_start_age,
      has_spouse,
      p2_birth_year,
      p2_current_age,
      p2_retirement_age,
      p2_life_expectancy,
      p2_social_security_monthly: p2_ss_monthly,
      p2_social_security_start_age,
      current_portfolio,
      monthly_contribution,
      stocks_pct,
      bonds_pct,
      cash_pct,
      other_income_annual,
      annual_spending,
      survivor_spending_pct: 75,
    },
    confidence,
    summary: {
      profile_count: profileCount,
      estimated_count: estimatedCount,
      missing_count: missingCount,
      has_household: !!household,
      has_spouse,
      has_assets: !!(assets && assets.length > 0),
      has_income: !!(income && income.length > 0),
      has_expenses: !!(expenses && expenses.length > 0),
    },
  })
}

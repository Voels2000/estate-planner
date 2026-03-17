import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeCompleteProjection } from '@/lib/calculations/projection-complete'
import type {
  AssetRowSelect,
  LiabilityRowSelect,
  IncomeRowSelect,
  ExpenseRowSelect,
} from '@/lib/types/planner-rows'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all data in parallel
  const [
    { data: household },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: irmaa_brackets },
  ] = await Promise.all([
    supabase
      .from('households')
      .select(`
        id, owner_id, person1_name, person1_birth_year, person1_retirement_age,
        person1_ss_claiming_age, person1_longevity_age, person1_ss_benefit_62, person1_ss_benefit_67,
        has_spouse, person2_name, person2_birth_year, person2_retirement_age,
        person2_ss_claiming_age, person2_longevity_age, person2_ss_benefit_62, person2_ss_benefit_67,
        filing_status, state_primary, inflation_rate,
        growth_rate_accumulation, growth_rate_retirement
      `)
      .eq('owner_id', user.id)
      .single(),
    supabase
      .from('assets')
      .select('id, type, value, owner')
      .eq('owner_id', user.id),
    supabase
      .from('liabilities')
      .select('id, type, balance, monthly_payment, interest_rate, owner')
      .eq('owner_id', user.id),
    supabase
      .from('income')
      .select('id, source, amount, start_year, end_year, inflation_adjust, owner')
      .eq('owner_id', user.id),
    supabase
      .from('expenses')
      .select('id, category, amount, inflation_adjust, owner')
      .eq('owner_id', user.id),
    supabase
      .from('irmaa_brackets')
      .select('magi_threshold, part_b_surcharge, part_d_surcharge, filing_status')
      .eq('tax_year', 2024),
  ])

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const rows = computeCompleteProjection({
    household,
    assets: (assets ?? []) as AssetRowSelect[],
    liabilities: (liabilities ?? []) as LiabilityRowSelect[],
    income: (income ?? []) as IncomeRowSelect[],
    expenses: (expenses ?? []) as ExpenseRowSelect[],
    irmaa_brackets: irmaa_brackets ?? [],
  })

  return NextResponse.json({ rows, household })
}

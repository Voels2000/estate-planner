import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeCompleteProjection } from '@/lib/calculations/projection-complete'
import type {
  AssetRowSelect,
  LiabilityRowSelect,
  IncomeRowSelect,
  ExpenseRowSelect,
} from '@/lib/types/planner-rows'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse optional scenario overrides from query params ────────────────────
  const sp = request.nextUrl.searchParams
  const overrides: Record<string, string | number | null> = {}

  if (sp.has('state_primary'))            overrides.state_primary             = sp.get('state_primary')
  if (sp.has('growth_rate_accumulation')) overrides.growth_rate_accumulation  = Number(sp.get('growth_rate_accumulation'))
  if (sp.has('growth_rate_retirement'))   overrides.growth_rate_retirement    = Number(sp.get('growth_rate_retirement'))
  if (sp.has('person1_retirement_age'))   overrides.person1_retirement_age    = Number(sp.get('person1_retirement_age'))
  if (sp.has('person1_ss_claiming_age'))  overrides.person1_ss_claiming_age   = Number(sp.get('person1_ss_claiming_age'))
  if (sp.has('person2_retirement_age'))   overrides.person2_retirement_age    = sp.get('person2_retirement_age') === 'null' ? null : Number(sp.get('person2_retirement_age'))
  if (sp.has('person2_ss_claiming_age'))  overrides.person2_ss_claiming_age   = sp.get('person2_ss_claiming_age') === 'null' ? null : Number(sp.get('person2_ss_claiming_age'))

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [
    { data: household },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: irmaa_brackets },
    { data: real_estate },
    { data: state_income_tax_rates },
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
    supabase.from('assets').select('id, type, value, owner').eq('owner_id', user.id),
    supabase.from('liabilities').select('id, type, balance, monthly_payment, interest_rate, owner').eq('owner_id', user.id),
    supabase.from('income').select('id, source, amount, start_year, end_year, inflation_adjust, ss_person').eq('owner_id', user.id),
    supabase.from('expenses').select('id, category, amount, inflation_adjust, owner').eq('owner_id', user.id),
    supabase.from('irmaa_brackets').select('magi_threshold, part_b_surcharge, part_d_surcharge, filing_status').eq('tax_year', 2024),
    supabase.from('real_estate').select('id, name, current_value, is_primary_residence, owner').eq('owner_id', user.id),
    // Fetch state income tax rates from DB — no hardcoding
    supabase.from('state_income_tax_rates').select('state_code, rate_pct, tax_year').order('tax_year', { ascending: false }),
  ])

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const rows = computeCompleteProjection({
    household,
    assets:                  (assets        ?? []) as AssetRowSelect[],
    liabilities:             (liabilities   ?? []) as LiabilityRowSelect[],
    income:                  (income        ?? []) as unknown as IncomeRowSelect[],
    expenses:                (expenses      ?? []) as ExpenseRowSelect[],
    irmaa_brackets:           irmaa_brackets ?? [],
    real_estate:             (real_estate   ?? []) as { id: string; name: string; current_value: number; is_primary_residence: boolean; owner: string }[],
    state_income_tax_rates:   state_income_tax_rates ?? [],
    overrides: Object.keys(overrides).length > 0 ? overrides as never : undefined,
  })

  return NextResponse.json({ rows, household })
}

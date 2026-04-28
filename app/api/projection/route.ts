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
    { data: state_income_tax_brackets },
    { data: businesses_data },
    { data: insurance_policies },
  ] = await Promise.all([
    supabase
      .from('households')
      .select(`
        id, owner_id, person1_name, person1_birth_year, person1_retirement_age,
        person1_ss_claiming_age, person1_longevity_age, person1_ss_pia,
        has_spouse, person2_name, person2_birth_year, person2_retirement_age,
        person2_ss_claiming_age, person2_longevity_age, person2_ss_pia,
        filing_status, state_primary, state_secondary, inflation_rate,
        growth_rate_accumulation, growth_rate_retirement,
        deduction_mode, custom_deduction_amount
      `)
      .eq('owner_id', user.id)
      .single(),
    supabase.from('assets').select('id, type, value, owner, cost_basis, basis_date, titling, liquidity').eq('owner_id', user.id),
    supabase.from('liabilities').select('id, type, balance, monthly_payment, interest_rate, owner').eq('owner_id', user.id),
    supabase.from('income').select('id, source, amount, start_year, end_year, start_month, end_month, inflation_adjust, ss_person').eq('owner_id', user.id),
    supabase.from('expenses').select('id, category, amount, start_year, end_year, start_month, end_month, inflation_adjust, owner').eq('owner_id', user.id),
    supabase.from('irmaa_brackets').select('magi_threshold, part_b_surcharge, part_d_surcharge, filing_status').order('tax_year', { ascending: false }).limit(20),
    supabase.from('real_estate').select('id, name, current_value, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, planned_sale_year, selling_costs_pct, owner').eq('owner_id', user.id),
    // Fetch state income tax rates from DB — no hardcoding
    supabase.from('state_income_tax_rates').select('state_code, rate_pct, tax_year').order('tax_year', { ascending: false }),
    supabase
      .from('state_income_tax_brackets')
      .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true })
      .order('filing_status', { ascending: true })
      .order('min_amount', { ascending: true }),
    supabase
      .from('businesses')
      .select('id, name, estimated_value, ownership_pct, owner')
      .eq('owner_id', user.id),
    supabase
      .from('insurance_policies')
      .select('death_benefit, cash_value, is_ilit, is_employer_provided')
      .eq('user_id', user.id),
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
    real_estate: (real_estate ?? []).map((r) => ({
      id: r.id as string,
      name: (r as { name?: string | null }).name ?? '',
      current_value: Number((r as { current_value?: number | null }).current_value ?? 0),
      mortgage_balance: (r as { mortgage_balance?: number | null }).mortgage_balance ?? null,
      monthly_payment: (r as { monthly_payment?: number | null }).monthly_payment ?? null,
      interest_rate: (r as { interest_rate?: number | null }).interest_rate ?? null,
      is_primary_residence: Boolean((r as { is_primary_residence?: boolean }).is_primary_residence),
      planned_sale_year: (r as { planned_sale_year?: number | null }).planned_sale_year ?? null,
      selling_costs_pct: (r as { selling_costs_pct?: number | null }).selling_costs_pct ?? 6,
      owner: (r as { owner?: string | null }).owner ?? '',
    })),
    state_income_tax_rates:   state_income_tax_rates ?? [],
    state_income_tax_brackets: (state_income_tax_brackets ?? []) as {
      state: string
      tax_year: number
      filing_status: 'single' | 'mfj'
      min_amount: number
      max_amount: number | null
      rate_pct: number
    }[],
    businesses: (businesses_data ?? []).map(b => ({
      id: b.id as string,
      name: b.name ?? 'Business',
      estimated_value: Number(b.estimated_value ?? 0),
      ownership_pct: b.ownership_pct ?? 100,
      owner: b.owner ?? undefined,
    })),
    insurance_policies: (insurance_policies ?? []).map((p) => ({
      death_benefit: Number((p as { death_benefit?: number | null }).death_benefit ?? 0) || null,
      cash_value: Number((p as { cash_value?: number | null }).cash_value ?? 0) || null,
      is_ilit: Boolean((p as { is_ilit?: boolean }).is_ilit),
      is_employer_provided: Boolean((p as { is_employer_provided?: boolean }).is_employer_provided),
    })),
    overrides: Object.keys(overrides).length > 0 ? overrides as never : undefined,
  })

  return NextResponse.json({ rows, household })
}

import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeCompleteProjection } from '@/lib/calculations/projection-complete'
import {
  loadBaseCaseScenario,
  loadLatestInputChangeMs,
  loadProjectionCalculatedAt,
} from '@/lib/dashboard/loaders'
import { isProjectionStale } from '@/lib/projections/staleness'
import type {
  AssetRowSelect,
  LiabilityRowSelect,
  IncomeRowSelect,
  ExpenseRowSelect,
} from '@/lib/types/planner-rows'
import type { YearRow } from '@/lib/calculations/projection-complete'
import { parseGrowthAssumptions } from '@/lib/types/growthAssumptions'

export type ProjectionOverrides = Record<string, string | number | null>

export function parseProjectionOverrides(
  sp: URLSearchParams,
): ProjectionOverrides {
  const overrides: ProjectionOverrides = {}
  if (sp.has('state_primary')) overrides.state_primary = sp.get('state_primary')
  if (sp.has('growth_rate_accumulation')) {
    overrides.growth_rate_accumulation = Number(sp.get('growth_rate_accumulation'))
  }
  if (sp.has('growth_rate_retirement')) {
    overrides.growth_rate_retirement = Number(sp.get('growth_rate_retirement'))
  }
  if (sp.has('real_estate_growth')) {
    overrides.real_estate_growth = Number(sp.get('real_estate_growth'))
  }
  if (sp.has('business_growth')) {
    overrides.business_growth = Number(sp.get('business_growth'))
  }
  if (sp.has('person1_retirement_age')) {
    overrides.person1_retirement_age = Number(sp.get('person1_retirement_age'))
  }
  if (sp.has('person1_ss_claiming_age')) {
    overrides.person1_ss_claiming_age = Number(sp.get('person1_ss_claiming_age'))
  }
  if (sp.has('person2_retirement_age')) {
    overrides.person2_retirement_age =
      sp.get('person2_retirement_age') === 'null' ? null : Number(sp.get('person2_retirement_age'))
  }
  if (sp.has('person2_ss_claiming_age')) {
    overrides.person2_ss_claiming_age =
      sp.get('person2_ss_claiming_age') === 'null' ? null : Number(sp.get('person2_ss_claiming_age'))
  }
  return overrides
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type LoadProjectionDataResult = {
  household: Record<string, unknown> | null
  rows: YearRow[]
  isFromCache?: boolean
}

const HOUSEHOLD_SELECT = `
        id, owner_id, person1_name, person1_birth_year, person1_retirement_age,
        person1_ss_claiming_age, person1_longevity_age, person1_ss_pia,
        has_spouse, person2_name, person2_birth_year, person2_retirement_age,
        person2_ss_claiming_age, person2_longevity_age, person2_ss_pia,
        filing_status, state_primary, state_secondary, inflation_rate,
        growth_rate_accumulation, growth_rate_retirement, growth_assumptions,
        deduction_mode, custom_deduction_amount
      `

/** Server-side projection load (shared by `/api/projection` and `/projections` page). */
export async function loadProjectionData(
  supabase: ServerSupabase,
  userId: string,
  overrides: ProjectionOverrides = {},
): Promise<LoadProjectionDataResult> {
  if (Object.keys(overrides).length === 0) {
    const { data: cacheHousehold } = await supabase
      .from('households')
      .select(`${HOUSEHOLD_SELECT}, base_case_scenario_id, updated_at`)
      .eq('owner_id', userId)
      .maybeSingle()

    if (!cacheHousehold) {
      return { household: null, rows: [] }
    }

    if (cacheHousehold.base_case_scenario_id) {
      const admin = createAdminClient()
      const [projectionCalculatedAt, latestInputChangeMs] = await Promise.all([
        loadProjectionCalculatedAt(admin, cacheHousehold.base_case_scenario_id),
        loadLatestInputChangeMs(supabase, userId, cacheHousehold.updated_at),
      ])
      const stale = isProjectionStale({
        baseCaseScenarioId: cacheHousehold.base_case_scenario_id,
        projectionCalculatedAt,
        latestInputChangeMs,
      })

      if (!stale) {
        const baseCase = await loadBaseCaseScenario(admin, cacheHousehold.base_case_scenario_id)
        const cachedOutputs = baseCase?.outputs_s1_first
        if (Array.isArray(cachedOutputs) && cachedOutputs.length > 0) {
          const { base_case_scenario_id: _scenarioId, updated_at: _updatedAt, ...household } =
            cacheHousehold
          return {
            household,
            rows: cachedOutputs as YearRow[],
            isFromCache: true,
          }
        }
      }
    }
  }

  const [
    { data: household },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: irmaa_brackets },
    { data: real_estate },
    { data: federal_income_tax_brackets },
    { data: state_income_tax_brackets },
    { data: businesses_data },
    { data: insurance_policies },
  ] = await Promise.all([
    supabase
      .from('households')
      .select(HOUSEHOLD_SELECT)
      .eq('owner_id', userId)
      .single(),
    supabase
      .from('assets')
      .select('id, type, value, owner, cost_basis, basis_date, titling, liquidity')
      .eq('owner_id', userId),
    supabase
      .from('liabilities')
      .select('id, type, balance, monthly_payment, interest_rate, owner')
      .eq('owner_id', userId),
    supabase
      .from('income')
      .select('id, source, amount, start_year, end_year, start_month, end_month, inflation_adjust, ss_person')
      .eq('owner_id', userId),
    supabase
      .from('expenses')
      .select('id, category, amount, start_year, end_year, start_month, end_month, inflation_adjust, owner')
      .eq('owner_id', userId),
    supabase
      .from('irmaa_brackets')
      .select('magi_threshold, part_b_surcharge, part_d_surcharge, filing_status')
      .order('tax_year', { ascending: false })
      .limit(20),
    supabase
      .from('real_estate')
      .select(
        'id, name, current_value, mortgage_balance, monthly_payment, interest_rate, is_primary_residence, planned_sale_year, selling_costs_pct, owner',
      )
      .eq('owner_id', userId),
    supabase
      .from('federal_tax_brackets')
      .select('filing_status, min_amount, max_amount, rate_pct, tax_year, bracket_order')
      .order('tax_year', { ascending: false })
      .order('filing_status', { ascending: true })
      .order('bracket_order', { ascending: true }),
    supabase
      .from('state_income_tax_brackets')
      .select('state, tax_year, filing_status, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('state', { ascending: true })
      .order('filing_status', { ascending: true })
      .order('min_amount', { ascending: true }),
    supabase.from('businesses').select('id, name, estimated_value, ownership_pct, owner').eq('owner_id', userId),
    supabase
      .from('insurance_policies')
      .select('death_benefit, cash_value, cash_value_growth_rate, is_ilit, is_employer_provided')
      .eq('user_id', userId),
  ])

  if (!household) {
    return { household: null, rows: [] }
  }

  const rows = computeCompleteProjection({
    household,
    growthAssumptions: parseGrowthAssumptions(household.growth_assumptions),
    assets: (assets ?? []) as AssetRowSelect[],
    liabilities: (liabilities ?? []) as LiabilityRowSelect[],
    income: (income ?? []) as unknown as IncomeRowSelect[],
    expenses: (expenses ?? []) as ExpenseRowSelect[],
    irmaa_brackets: irmaa_brackets ?? [],
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
    federal_income_tax_brackets: (federal_income_tax_brackets ?? []) as {
      filing_status: string
      min_amount: number
      max_amount: number | null
      rate_pct: number
      tax_year?: number | null
      bracket_order?: number | null
    }[],
    state_income_tax_brackets: (state_income_tax_brackets ?? []) as {
      state: string
      tax_year: number
      filing_status: 'single' | 'mfj'
      min_amount: number
      max_amount: number | null
      rate_pct: number
    }[],
    businesses: (businesses_data ?? []).map((b) => ({
      id: b.id as string,
      name: b.name ?? 'Business',
      estimated_value: Number(b.estimated_value ?? 0),
      ownership_pct: b.ownership_pct ?? 100,
      owner: b.owner ?? undefined,
    })),
    insurance_policies: (insurance_policies ?? []).map((p) => ({
      death_benefit: Number((p as { death_benefit?: number | null }).death_benefit ?? 0) || null,
      cash_value: Number((p as { cash_value?: number | null }).cash_value ?? 0) || null,
      cash_value_growth_rate: Number((p as { cash_value_growth_rate?: number | null }).cash_value_growth_rate ?? 0) || 0,
      is_ilit: Boolean((p as { is_ilit?: boolean }).is_ilit),
      is_employer_provided: Boolean((p as { is_employer_provided?: boolean }).is_employer_provided),
    })),
    overrides: Object.keys(overrides).length > 0 ? (overrides as never) : undefined,
  })

  return { household, rows }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getLatestTimestampMs } from '@/lib/projections/staleness'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type AdminSupabase = ReturnType<typeof createAdminClient>

export async function loadProjectionCalculatedAt(
  admin: AdminSupabase,
  baseCaseScenarioId: string | null | undefined,
): Promise<string | null> {
  if (!baseCaseScenarioId) return null
  const { data } = await admin
    .from('projection_scenarios')
    .select('calculated_at')
    .eq('id', baseCaseScenarioId)
    .single()
  return data?.calculated_at ?? null
}

export async function loadBaseCaseScenario(
  admin: AdminSupabase,
  baseCaseScenarioId: string | null | undefined,
) {
  if (!baseCaseScenarioId) return null
  const { data } = await admin
    .from('projection_scenarios')
    .select('outputs_s1_first, assumption_snapshot')
    .eq('id', baseCaseScenarioId)
    .single()
  return data ?? null
}

async function getLatestChangeTs(
  supabase: ServerSupabase,
  table: string,
  ownerColumn: string,
  ownerValue: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select('updated_at, created_at')
    .eq(ownerColumn, ownerValue)
    .order('updated_at', { ascending: false })
    .limit(1)
  const row = (data?.[0] ?? null) as { updated_at?: string | null; created_at?: string | null } | null
  return row?.updated_at ?? row?.created_at ?? null
}

export async function loadLatestChangeTs(
  supabase: ServerSupabase,
  table: string,
  ownerColumn: string,
  ownerValue: string,
): Promise<string | null> {
  return getLatestChangeTs(supabase, table, ownerColumn, ownerValue)
}

export async function loadLatestInputChangeMs(
  supabase: ServerSupabase,
  userId: string,
  householdUpdatedAt: string | null | undefined,
): Promise<number> {
  const [
    assetsChangedAt,
    liabilitiesChangedAt,
    incomeChangedAt,
    expensesChangedAt,
    realEstateChangedAt,
    businessesChangedAt,
    businessInterestsChangedAt,
    insuranceChangedAt,
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  ] = await Promise.all([
    getLatestChangeTs(supabase, 'assets', 'owner_id', userId),
    getLatestChangeTs(supabase, 'liabilities', 'owner_id', userId),
    getLatestChangeTs(supabase, 'income', 'owner_id', userId),
    getLatestChangeTs(supabase, 'expenses', 'owner_id', userId),
    getLatestChangeTs(supabase, 'real_estate', 'owner_id', userId),
    getLatestChangeTs(supabase, 'businesses', 'owner_id', userId),
    getLatestChangeTs(supabase, 'business_interests', 'owner_id', userId),
    getLatestChangeTs(supabase, 'insurance_policies', 'user_id', userId),
    (async () => {
      const { data } = await supabase
        .from('state_income_tax_brackets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = (data?.[0] ?? null) as { created_at?: string | null } | null
      return row?.created_at ?? null
    })(),
    (async () => {
      const { data } = await supabase
        .from('federal_tax_brackets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = (data?.[0] ?? null) as { created_at?: string | null } | null
      return row?.created_at ?? null
    })(),
  ])

  return getLatestTimestampMs([
    householdUpdatedAt ?? null,
    assetsChangedAt,
    liabilitiesChangedAt,
    incomeChangedAt,
    expensesChangedAt,
    realEstateChangedAt,
    businessesChangedAt,
    businessInterestsChangedAt,
    insuranceChangedAt,
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  ])
}

export async function loadDashboardCoreInputs(supabase: ServerSupabase, userId: string) {
  const [
    { data: profile },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: realEstate },
    { data: businesses },
    { data: businessInterests },
    { data: insurance },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('assets').select('value').eq('owner_id', userId),
    supabase.from('liabilities').select('balance').eq('owner_id', userId),
    supabase.from('income').select('amount, source, start_year, end_year').eq('owner_id', userId),
    supabase.from('expenses').select('amount').eq('owner_id', userId),
    supabase.from('real_estate').select('current_value, mortgage_balance, monthly_payment, titling').eq('owner_id', userId),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', userId),
    supabase
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', userId),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', userId),
  ])

  return {
    profile,
    assets,
    liabilities,
    income,
    expenses,
    realEstate,
    businesses,
    businessInterests,
    insurance,
  }
}

export async function loadDashboardRmdInputs(supabase: ServerSupabase, userId: string) {
  const [{ data: taxDeferredAssets }, { data: currentYearWithdrawals }] = await Promise.all([
    supabase
      .from('assets')
      .select('value, owner, type')
      .eq('owner_id', userId)
      .in('type', [
        'traditional_401k',
        'traditional_ira',
        '401k',
        'ira',
        'traditional_403b',
        'sep_ira',
        'simple_ira',
        '457',
        'sep',
      ]),
    supabase
      .from('income')
      .select('amount, source, ss_person, start_year, end_year')
      .eq('owner_id', userId)
      .in('source', ['traditional_401k', 'traditional_ira']),
  ])

  return {
    taxDeferredAssets,
    currentYearWithdrawals,
  }
}

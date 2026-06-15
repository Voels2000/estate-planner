import type { createAdminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'
import type { AssessmentHistoryRow } from '@/lib/dashboard/loadAssessmentHistory'
import { getLatestTimestampMs } from '@/lib/projections/staleness'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type AdminSupabase = ReturnType<typeof createAdminClient>

const TTL_MS = 60_000

const bundleCache = new Map<string, { expiresAt: number; bundle: DashboardBundle }>()

export function invalidateDashboardBundle(householdId: string): void {
  if (householdId) bundleCache.delete(householdId)
}

export type DashboardBundle = {
  profile: Record<string, unknown> | null
  assets: Array<Record<string, unknown>>
  liabilities: Array<Record<string, unknown>>
  income: Array<Record<string, unknown>>
  expenses: Array<Record<string, unknown>>
  realEstate: Array<Record<string, unknown>>
  businesses: Array<Record<string, unknown>>
  businessInterests: Array<Record<string, unknown>>
  insurance: Array<Record<string, unknown>>
  lifeEventsPending: Array<Record<string, unknown>>
  lifeEventsLogged: Array<Record<string, unknown>>
  advisorConnection: Record<string, unknown> | null
  advisorStrategyItems: Array<Record<string, unknown>> | null
  mcScenarioRows: Array<Record<string, unknown>>
  healthScoreRow: Record<string, unknown> | null
  openAlertsData: Array<Record<string, unknown>>
  conflictRows: Array<Record<string, unknown>> | null
  stateExemptionRow: Record<string, unknown> | null
  assessmentResults: AssessmentHistoryRow[]
  assetTypes: Array<Record<string, unknown>>
  stateIncomeTaxBracketsChangedAt: string | null
  federalIncomeTaxBracketsChangedAt: string | null
}

function maxRowTimestamp(rows: Array<Record<string, unknown>>): string | null {
  let max = 0
  let maxTs: string | null = null
  for (const row of rows) {
    const ts = (row.updated_at ?? row.created_at) as string | null | undefined
    if (!ts) continue
    const ms = new Date(ts).getTime()
    if (Number.isFinite(ms) && ms > max) {
      max = ms
      maxTs = ts
    }
  }
  return maxTs
}

export function setupProgressFromBundle(bundle: DashboardBundle): SetupProgressCounts {
  const counts = {
    assets: bundle.assets.length,
    income: bundle.income.length,
    expenses: bundle.expenses.length,
    liabilities: bundle.liabilities.length,
    insurance: bundle.insurance.length,
  }
  return {
    ...counts,
    hasAnyData: Object.values(counts).some((n) => n > 0),
  }
}

export function latestInputChangeMsFromBundle(
  bundle: DashboardBundle,
  householdUpdatedAt: string | null | undefined,
): number {
  return getLatestTimestampMs([
    householdUpdatedAt ?? null,
    maxRowTimestamp(bundle.assets),
    maxRowTimestamp(bundle.liabilities),
    maxRowTimestamp(bundle.income),
    maxRowTimestamp(bundle.expenses),
    maxRowTimestamp(bundle.realEstate),
    maxRowTimestamp(bundle.businesses),
    maxRowTimestamp(bundle.businessInterests),
    maxRowTimestamp(bundle.insurance),
    bundle.stateIncomeTaxBracketsChangedAt,
    bundle.federalIncomeTaxBracketsChangedAt,
  ])
}

export function coreInputsFromBundle(bundle: DashboardBundle) {
  return {
    profile: bundle.profile,
    assets: bundle.assets.map((a) => ({ value: a.value, type: a.type })),
    liabilities: bundle.liabilities.map((l) => ({ balance: l.balance })),
    income: bundle.income.map((i) => ({
      amount: i.amount,
      source: i.source,
      start_year: i.start_year,
      end_year: i.end_year,
    })),
    expenses: bundle.expenses.map((e) => ({ amount: e.amount })),
    realEstate: bundle.realEstate.map((r) => ({
      current_value: r.current_value,
      mortgage_balance: r.mortgage_balance,
      monthly_payment: r.monthly_payment,
      titling: r.titling,
      situs_state: r.situs_state,
    })),
    businesses: bundle.businesses.map((b) => ({
      estimated_value: b.estimated_value,
      ownership_pct: b.ownership_pct,
    })),
    businessInterests: bundle.businessInterests.map((b) => ({
      fmv_estimated: b.fmv_estimated,
      total_entity_value: b.total_entity_value,
      ownership_pct: b.ownership_pct,
    })),
    insurance: bundle.insurance.map((p) => ({
      death_benefit: p.death_benefit,
      is_ilit: p.is_ilit,
    })),
  }
}

const TAX_DEFERRED_TYPES = new Set([
  'traditional_401k',
  'traditional_ira',
  '401k',
  'ira',
  'traditional_403b',
  'sep_ira',
  'simple_ira',
  '457',
  'sep',
])

export function rmdInputsFromBundle(bundle: DashboardBundle) {
  const taxDeferredAssets = bundle.assets
    .filter((a) => TAX_DEFERRED_TYPES.has(String(a.type ?? '')))
    .map((a) => ({ value: a.value, owner: a.owner, type: a.type }))
  const currentYearWithdrawals = bundle.income
    .filter((i) => i.source === 'traditional_401k' || i.source === 'traditional_ira')
    .map((i) => ({
      amount: i.amount,
      source: i.source,
      ss_person: i.ss_person,
      start_year: i.start_year,
      end_year: i.end_year,
    }))
  return { taxDeferredAssets, currentYearWithdrawals }
}

export async function loadDashboardBundle(
  supabase: ServerSupabase,
  admin: AdminSupabase,
  params: {
    userId: string
    householdId: string
    statePrimary: string | null | undefined
  },
): Promise<DashboardBundle> {
  const skipCache = process.env.E2E_SKIP_RECOMPUTE === 'true'
  const cached = skipCache ? undefined : bundleCache.get(params.householdId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bundle
  }

  const currentYear = new Date().getFullYear()
  const stateCode = params.statePrimary ? String(params.statePrimary).toUpperCase() : ''

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
    { data: lifeEventsPending },
    { data: lifeEventsLogged },
    { data: advisorConnection },
    { data: advisorStrategyItems },
    { data: mcScenarioRows },
    { data: healthScoreRow },
    { data: openAlertsData },
    { data: conflictRows },
    { data: stateExemptionRow },
    { data: assessmentRows },
    { data: assetTypes },
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.userId).single(),
    supabase
      .from('assets')
      .select('value, type, owner, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('liabilities')
      .select('balance, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('income')
      .select('amount, source, start_year, end_year, ss_person, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('expenses')
      .select('amount, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('real_estate')
      .select(
        'current_value, mortgage_balance, monthly_payment, titling, situs_state, updated_at, created_at',
      )
      .eq('owner_id', params.userId),
    supabase
      .from('businesses')
      .select('estimated_value, ownership_pct, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct, updated_at, created_at')
      .eq('owner_id', params.userId),
    supabase
      .from('insurance_policies')
      .select('death_benefit, is_ilit, updated_at, created_at')
      .eq('user_id', params.userId),
    supabase
      .from('life_events')
      .select('id, event_type, source, acknowledged, created_at')
      .eq('user_id', params.userId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('life_events')
      .select('id, event_type, created_at')
      .eq('user_id', params.userId)
      .eq('source', 'user')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('advisor_clients')
      .select(`
        id,
        accepted_at,
        profiles!advisor_clients_advisor_id_fkey (
          full_name,
          email
        )
      `)
      .eq('client_id', params.userId)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
      .maybeSingle(),
    supabase
      .from('strategy_line_items')
      .select(
        'id, strategy_source, amount, sign, scenario_name, consumer_accepted, consumer_rejected',
      )
      .eq('household_id', params.householdId)
      .eq('source_role', 'advisor')
      .eq('is_active', true),
    supabase
      .from('advisor_projection_assumptions')
      .select(
        'id, scenario_name, shared_at, accepted_by_client, accepted_at, return_mean_pct, volatility_pct, withdrawal_rate_pct, success_threshold, simulation_count, planning_horizon_yr, inflation_rate_pct',
      )
      .eq('client_household_id', params.householdId)
      .or('accepted_by_client.eq.true,shared_at.not.is.null')
      .order('accepted_at', { ascending: false, nullsFirst: false }),
    admin
      .from('estate_health_scores')
      .select('score, component_scores, computed_at, recommendations')
      .eq('household_id', params.householdId)
      .maybeSingle(),
    admin
      .from('household_alerts')
      .select('id, title, description, severity, created_at, action_href')
      .eq('household_id', params.householdId)
      .is('resolved_at', null)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('beneficiary_conflicts')
      .select('conflict_type, severity, asset_id, real_estate_id, description, recommended_action')
      .eq('household_id', params.householdId),
    stateCode
      ? supabase
          .from('state_estate_tax_rules')
          .select('exemption_amount, no_portability')
          .eq('state', stateCode)
          .eq('tax_year', currentYear)
          .order('min_amount', { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('assessment_results')
      .select('id, taken_at, overall_score, financial_pct, retirement_pct, estate_pct')
      .eq('user_id', params.userId)
      .order('taken_at', { ascending: false })
      .limit(3),
    supabase.from('asset_types').select('value, label').eq('is_active', true).order('sort_order'),
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

  const bundle: DashboardBundle = {
    profile: profile ?? null,
    assets: assets ?? [],
    liabilities: liabilities ?? [],
    income: income ?? [],
    expenses: expenses ?? [],
    realEstate: realEstate ?? [],
    businesses: businesses ?? [],
    businessInterests: businessInterests ?? [],
    insurance: insurance ?? [],
    lifeEventsPending: lifeEventsPending ?? [],
    lifeEventsLogged: lifeEventsLogged ?? [],
    advisorConnection: advisorConnection ?? null,
    advisorStrategyItems: advisorStrategyItems ?? null,
    mcScenarioRows: mcScenarioRows ?? [],
    healthScoreRow: healthScoreRow ?? null,
    openAlertsData: openAlertsData ?? [],
    conflictRows: conflictRows ?? null,
    stateExemptionRow: stateExemptionRow ?? null,
    assessmentResults: (assessmentRows ?? []) as AssessmentHistoryRow[],
    assetTypes: assetTypes ?? [],
    stateIncomeTaxBracketsChangedAt,
    federalIncomeTaxBracketsChangedAt,
  }

  if (!skipCache) {
    bundleCache.set(params.householdId, {
      bundle,
      expiresAt: Date.now() + TTL_MS,
    })
  }

  return bundle
}

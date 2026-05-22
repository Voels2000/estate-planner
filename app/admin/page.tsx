import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminClient } from './_admin-client'

export default async function AdminPage() {
  const supabase = await createClient()

  // User stats
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, subscription_status, subscription_plan, created_at')
    .order('created_at', { ascending: false })

  // Usage stats
  const [
    { count: assetCount },
    { count: incomeCount },
    { count: expenseCount },
    { count: projectionCount },
  ] = await Promise.all([
    supabase.from('assets').select('*', { count: 'exact', head: true }),
    supabase.from('income').select('*', { count: 'exact', head: true }),
    supabase.from('expenses').select('*', { count: 'exact', head: true }),
    supabase.from('projections').select('*', { count: 'exact', head: true }),
  ])

  // App config
  const { data: appConfig } = await supabase
    .from('app_config')
    .select('*')
    .order('key')

  // T&C content
  const termsVersionRow  = appConfig?.find(r => r.key === 'terms_version')
  const termsSectionsRow = appConfig?.find(r => r.key === 'terms_sections')

  const termsVersion  = termsVersionRow?.value  ?? '2026-03-31'
  const termsSections = (() => {
    try { return JSON.parse(termsSectionsRow?.value ?? '[]') } catch { return [] }
  })()

  const { data: advisorTiers } = await supabase
    .from('advisor_tiers')
    .select('*')
    .order('display_order')

  const { data: assetTypes } = await supabase
    .from('asset_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: liabilityTypes } = await supabase
    .from('liability_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: incomeTypes } = await supabase
    .from('income_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: expenseTypes } = await supabase
    .from('expense_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refTitlingTypes } = await supabase
    .from('ref_titling_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refLiquidityTypes } = await supabase
    .from('ref_liquidity_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refValuationMethods } = await supabase
    .from('ref_valuation_methods')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refSuccessionPlans } = await supabase
    .from('ref_succession_plans')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refPropertyTypes } = await supabase
    .from('ref_property_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refInsuranceTypes } = await supabase
    .from('ref_insurance_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: refPcInsuranceTypes } = await supabase
    .from('ref_pc_insurance_types')
    .select('value, label, sort_order, is_active')
    .order('sort_order')

  const { data: titlingCategories } = await supabase
    .from('titling_asset_categories')
    .select('value, label, icon, sort_order, is_active')
    .order('sort_order')

  // Feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  // ─── Funnel analytics (service role — funnel_events RLS is not admin-readable via user client) ───
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  const [
    { data: funnelBySlug },
    { data: funnelByReferral },
    { data: recentFunnelEvents },
    // NEW: full 30-day step counts (replaces client-side last-50 count)
    { data: funnelStepCounts },
    // NEW: event → tier conversion (funnel_events joined to profiles.consumer_tier)
    { data: tierConversionRaw },
  ] = await Promise.all([
    admin
      .from('funnel_events')
      .select('event_slug, event_name')
      .gte('created_at', thirtyDaysAgoISO)
      .not('event_slug', 'is', null),

    admin
      .from('funnel_events')
      .select('referral_code, event_name')
      .gte('created_at', thirtyDaysAgoISO)
      .not('referral_code', 'is', null),

    admin
      .from('funnel_events')
      .select('event_name, event_slug, referral_code, created_at, properties')
      .order('created_at', { ascending: false })
      .limit(50),

    // Full 30-day aggregation by event_name — used for bar chart step counts
    // Supabase JS client doesn't support GROUP BY directly; fetch all rows and aggregate server-side.
    // This avoids a raw SQL RPC call while keeping the data fresh.
    admin
      .from('funnel_events')
      .select('event_name')
      .gte('created_at', thirtyDaysAgoISO),

    // Tier conversion: all funnel events with a user_id in the last 30 days,
    // joined to profiles to get consumer_tier. Anon events (user_id null) are excluded
    // intentionally — tier is only meaningful once a profile exists.
    admin
      .from('funnel_events')
      .select('event_name, profiles!inner(consumer_tier)')
      .gte('created_at', thirtyDaysAgoISO)
      .not('user_id', 'is', null),
  ])

  // Aggregate step counts server-side (avoids raw SQL RPC)
  const stepCountMap: Record<string, number> = {}
  for (const row of funnelStepCounts ?? []) {
    stepCountMap[row.event_name] = (stepCountMap[row.event_name] ?? 0) + 1
  }

  // Aggregate tier conversion: Map<tier, Map<event_name, count>>
  // consumer_tier values: 1 (Financial), 2 (Retirement), 3 (Estate), null (free/unsubscribed)
  type TierConversionRow = {
    event_name: string
    profiles: { consumer_tier: number | null } | { consumer_tier: number | null }[]
  }
  const tierConversionMap = new Map<string, Record<string, number>>()

  for (const row of (tierConversionRaw ?? []) as TierConversionRow[]) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const consumerTier = profile?.consumer_tier ?? null
    const tier = consumerTier != null ? `tier_${consumerTier}` : 'free'
    if (!tierConversionMap.has(tier)) tierConversionMap.set(tier, {})
    const m = tierConversionMap.get(tier)!
    m[row.event_name] = (m[row.event_name] ?? 0) + 1
  }

  const tierConversion = Array.from(tierConversionMap.entries()).map(([tier, counts]) => ({
    tier,
    counts,
  }))

  // ─── Compute stats ───
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - 7)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalUsers = profiles?.length ?? 0
  const newToday = profiles?.filter(p => new Date(p.created_at) >= startOfDay).length ?? 0
  const newThisWeek = profiles?.filter(p => new Date(p.created_at) >= startOfWeek).length ?? 0
  const newThisMonth = profiles?.filter(p => new Date(p.created_at) >= startOfMonth).length ?? 0

  const activeSubscriptions = profiles?.filter(p =>
    p.subscription_status === 'active' || p.subscription_status === 'trialing'
  ).length ?? 0

  const consumerCount = profiles?.filter(p => p.subscription_plan === 'consumer').length ?? 0
  const advisorCount = profiles?.filter(p => p.subscription_plan === 'advisor').length ?? 0

  // MRR estimate
  const mrr = (consumerCount * 19) + (advisorCount * 159)

  return (
    <AdminClient
      totalUsers={totalUsers}
      newToday={newToday}
      newThisWeek={newThisWeek}
      newThisMonth={newThisMonth}
      activeSubscriptions={activeSubscriptions}
      consumerCount={consumerCount}
      advisorCount={advisorCount}
      mrr={mrr}
      assetCount={assetCount ?? 0}
      incomeCount={incomeCount ?? 0}
      expenseCount={expenseCount ?? 0}
      projectionCount={projectionCount ?? 0}
      profiles={profiles ?? []}
      feedback={feedback ?? []}
      appConfig={appConfig ?? []}
      advisorTiers={advisorTiers ?? []}
      assetTypes={assetTypes ?? []}
      liabilityTypes={liabilityTypes ?? []}
      incomeTypes={incomeTypes ?? []}
      expenseTypes={expenseTypes ?? []}
      refTitlingTypes={refTitlingTypes ?? []}
      refLiquidityTypes={refLiquidityTypes ?? []}
      refValuationMethods={refValuationMethods ?? []}
      refSuccessionPlans={refSuccessionPlans ?? []}
      refPropertyTypes={refPropertyTypes ?? []}
      refInsuranceTypes={refInsuranceTypes ?? []}
      refPcInsuranceTypes={refPcInsuranceTypes ?? []}
      titlingCategories={titlingCategories ?? []}
      termsVersion={termsVersion}
      termsSections={termsSections}
      funnelBySlug={funnelBySlug ?? []}
      funnelByReferral={funnelByReferral ?? []}
      recentFunnelEvents={recentFunnelEvents ?? []}
      // NEW props
      funnelStepCounts={stepCountMap}
      tierConversion={tierConversion}
    />
  )
}

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAdminMrr } from '@/lib/billing/computeAdminMrr'
import { countDistinctClientIds, firmConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { ACTIVE_ATTORNEY_CLIENT_STATUSES } from '@/lib/attorney/attorneyClientCap'
import { getCanonicalTerms } from '@/lib/terms/getCanonicalTerms'
import { computeOpsTaskUrgency } from '@/lib/admin/opsTasks'
import { filterReportingProfiles, isReportingExcludedCanaryEmail } from '@/lib/admin/reportingCanary'
import type { OpsTaskRow } from '@/lib/admin/opsTasks'
import type { CronHealthRow, OpsInboxCounts } from './ops-home-tab'
import { AdminClient } from './_admin-client'

export default async function AdminPage() {
  const supabase = await createClient()

  // User stats
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, consumer_tier, attorney_tier, subscription_status, subscription_plan, created_at')
    .order('created_at', { ascending: false })

  const profiles = filterReportingProfiles(profilesRaw ?? [])
  const excludedOwnerIds = new Set(
    (profilesRaw ?? [])
      .filter((p) => isReportingExcludedCanaryEmail(p.email))
      .map((p) => p.id),
  )

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

  // T&C content — canonical source: lib/legal/terms-of-service-sections.ts
  const { version: termsVersion, sections: termsSections } = getCanonicalTerms()

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
    { data: betaLinkViewEvents },
    { data: betaAccountEvents },
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

    admin
      .from('funnel_events')
      .select('properties')
      .eq('event_name', 'beta_signup_link_viewed')
      .gte('created_at', thirtyDaysAgoISO),

    admin
      .from('funnel_events')
      .select('properties')
      .eq('event_name', 'account_created')
      .contains('properties', { signup_source: 'beta_access_link' })
      .gte('created_at', thirtyDaysAgoISO),
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

  type FunnelProperties = { label?: string; beta_label?: string } | null
  const betaCohortMap = new Map<string, { linkViews: number; accounts: number }>()
  const cohortLabelFromProps = (properties: FunnelProperties) => {
    const label = properties?.label?.trim() || properties?.beta_label?.trim()
    return label || '(no label)'
  }
  for (const row of betaLinkViewEvents ?? []) {
    const label = cohortLabelFromProps(row.properties as FunnelProperties)
    if (!betaCohortMap.has(label)) betaCohortMap.set(label, { linkViews: 0, accounts: 0 })
    betaCohortMap.get(label)!.linkViews += 1
  }
  for (const row of betaAccountEvents ?? []) {
    const label = cohortLabelFromProps(row.properties as FunnelProperties)
    if (!betaCohortMap.has(label)) betaCohortMap.set(label, { linkViews: 0, accounts: 0 })
    betaCohortMap.get(label)!.accounts += 1
  }
  const betaSignupCohorts = Array.from(betaCohortMap.entries())
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.accounts - a.accounts || b.linkViews - a.linkViews)

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

  const activePaid = (p: { subscription_status: string | null }) =>
    p.subscription_status === 'active' || p.subscription_status === 'trialing'

  const tier1Count =
    profiles?.filter((p) => p.consumer_tier === 1 && activePaid(p)).length ?? 0
  const tier2Count =
    profiles?.filter((p) => p.consumer_tier === 2 && activePaid(p)).length ?? 0
  const tier3Count =
    profiles?.filter((p) => p.consumer_tier === 3 && activePaid(p)).length ?? 0

  const { data: activeFirmsRaw } = await admin
    .from('firms')
    .select('id, seat_count, tier, owner_id, billing_floor')
    .in('subscription_status', ['active', 'trialing'])

  const activeFirmsFiltered = (activeFirmsRaw ?? []).filter(
    (f) => !f.owner_id || !excludedOwnerIds.has(f.owner_id),
  )

  const activeFirms = isConnectionBillingEnabled()
    ? await Promise.all(
        activeFirmsFiltered.map(async (firm) => ({
          seat_count: firm.seat_count,
          tier: firm.tier,
          billing_floor: firm.billing_floor,
          connected_count: firm.id ? await firmConnectedHouseholds(admin, firm.id) : 0,
        })),
      )
    : activeFirmsFiltered.map(({ seat_count, tier }) => ({ seat_count, tier }))

  const { data: activeAttorneyListingsRaw } = await admin
    .from('attorney_listings')
    .select('id, billing_floor, profile_id, profiles!inner(subscription_status)')
    .not('profile_id', 'is', null)
    .in('profiles.subscription_status', ['active', 'trialing'])

  const activeAttorneyListingRows = (activeAttorneyListingsRaw ?? []).filter(
    (row) => !row.profile_id || !excludedOwnerIds.has(row.profile_id),
  )

  const attorneyListingIds = activeAttorneyListingRows.map((row) => row.id)
  const connectedByAttorneyListingId = new Map<string, number>()

  if (attorneyListingIds.length > 0) {
    const { data: attorneyClientLinks } = await admin
      .from('attorney_clients')
      .select('attorney_id, client_id')
      .in('attorney_id', attorneyListingIds)
      .in('status', [...ACTIVE_ATTORNEY_CLIENT_STATUSES])

    const linksByListingId = new Map<string, { client_id: string }[]>()
    for (const link of attorneyClientLinks ?? []) {
      const bucket = linksByListingId.get(link.attorney_id) ?? []
      bucket.push({ client_id: link.client_id })
      linksByListingId.set(link.attorney_id, bucket)
    }
    for (const listingId of attorneyListingIds) {
      connectedByAttorneyListingId.set(
        listingId,
        countDistinctClientIds(linksByListingId.get(listingId) ?? []),
      )
    }
  }

  const activeAttorneyListings = activeAttorneyListingRows.map((row) => ({
    billing_floor: row.billing_floor,
    connected_count: connectedByAttorneyListingId.get(row.id) ?? 0,
  }))

  const { consumerMrr, firmMrr, attorneyMrr, mrr } = computeAdminMrr(
    profiles ?? [],
    activeFirms ?? [],
    activeAttorneyListings,
  )

  const nowIso = new Date().toISOString()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [
    { data: opsTasks },
    { data: cronHealth },
    { count: overdueDeletionsCount },
    { count: urgentPrivacyCount },
    { data: pendingAdvisors },
    { data: pendingAttorneys },
  ] = await Promise.all([
    admin.from('ops_tasks').select('*').order('next_due_at', { ascending: true }),
    admin.from('cron_health').select('*'),
    admin
      .from('deletion_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('scheduled_for', nowIso),
    admin
      .from('privacy_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])
      .lte('due_at', sevenDaysFromNow.toISOString()),
    admin
      .from('advisor_directory')
      .select('id')
      .eq('is_active', false)
      .eq('is_verified', false),
    admin
      .from('attorney_listings')
      .select('id')
      .eq('is_active', false)
      .eq('is_verified', false),
  ])

  const taskRows = (opsTasks ?? []) as OpsTaskRow[]
  const taskNow = new Date()
  let overdueTasks = 0
  let dueTodayTasks = 0
  for (const t of taskRows) {
    if (t.status === 'completed' && t.cadence === 'once') continue
    const u = computeOpsTaskUrgency(t, taskNow)
    if (u === 'overdue') overdueTasks++
    if (u === 'due-today') dueTodayTasks++
  }

  const staleThreshold = new Date(Date.now() - 26 * 60 * 60 * 1000)
  const healthRows = (cronHealth ?? []) as CronHealthRow[]
  const cronFailures = healthRows.filter(
    (j) => j.last_status === 'error' || (j.consecutive_failures ?? 0) > 1,
  ).length
  const staleCrons = healthRows.filter(
    (j) => !j.last_run_at || new Date(j.last_run_at) < staleThreshold,
  ).length

  const inboxCounts: OpsInboxCounts = {
    overdueTasks,
    dueTodayTasks,
    overdueDeletions: overdueDeletionsCount ?? 0,
    urgentPrivacy: urgentPrivacyCount ?? 0,
    pendingDirectories:
      (pendingAdvisors?.length ?? 0) + (pendingAttorneys?.length ?? 0),
    cronFailures,
    staleCrons,
  }

  const fetchedAt = new Date().toISOString()

  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">Loading admin…</div>}>
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
      betaSignupCohorts={betaSignupCohorts}
      opsTasks={taskRows}
      cronHealth={healthRows}
      inboxCounts={inboxCounts}
      pendingAdvisorDirectory={pendingAdvisors?.length ?? 0}
      pendingAttorneyDirectory={pendingAttorneys?.length ?? 0}
      fetchedAt={fetchedAt}
    />
    </Suspense>
  )
}

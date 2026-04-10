import { createClient } from '@/lib/supabase/server'
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

  const { data: titlingCategories } = await supabase
    .from('titling_asset_categories')
    .select('value, label, icon, sort_order, is_active')
    .order('sort_order')

  // Feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  // Compute stats
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
      titlingCategories={titlingCategories ?? []}
      termsVersion={termsVersion}
      termsSections={termsSections}
    />
  )
}

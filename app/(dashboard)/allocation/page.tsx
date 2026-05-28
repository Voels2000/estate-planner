import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadAssetAllocationData } from '@/lib/allocation/loadAssetAllocationData'
import AllocationClient from './_allocation-client'

export const metadata = {
  title: 'Asset Allocation | Estate Planner',
  description: 'Define your target mix of stocks, bonds, and cash',
}

export default async function AssetAllocationPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!hasFeatureAccess('allocation', access.tier, access.isAdvisor, access.isTrial)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Asset Allocation</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('allocation')}
          moduleName="Asset Allocation"
          valueProposition="See your full portfolio breakdown, advisor-entered targets, and how rebalancing affects your projected retirement income and estate value."
        />
      </div>
    )
  }

  const [{ data: household }, allocationData] = await Promise.all([
    supabase
      .from('households')
      .select('target_stocks_pct, target_bonds_pct, target_cash_pct, risk_tolerance')
      .eq('owner_id', user.id)
      .maybeSingle(),
    loadAssetAllocationData(supabase, user.id),
  ])

  const initialTargets =
    household?.target_stocks_pct != null
      ? {
          target_stocks_pct: household.target_stocks_pct,
          target_bonds_pct: household.target_bonds_pct ?? 30,
          target_cash_pct: household.target_cash_pct ?? 10,
        }
      : null

  const initialRiskTolerance =
    household?.risk_tolerance === 'conservative' ||
    household?.risk_tolerance === 'moderate' ||
    household?.risk_tolerance === 'aggressive'
      ? household.risk_tolerance
      : 'moderate'

  return (
    <AllocationClient
      userTier={access.tier}
      initialTargets={initialTargets}
      initialRiskTolerance={initialRiskTolerance}
      initialAllocationData={allocationData}
    />
  )
}

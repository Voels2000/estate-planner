// ─────────────────────────────────────────
// Menu: Retirement Planning > Monte Carlo
// Route: /monte-carlo
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { featureUpgradeTier, hasFeatureAccess } from '@/lib/tiers'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { loadUpgradeBannerHouseholdContext } from '@/lib/dashboard/upgradeBannerHouseholdContext'
import { loadMonteCarloPrefill } from '@/lib/monte-carlo/loadMonteCarloPrefill'
import { loadMonteCarloHistory } from '@/lib/monte-carlo/loadMonteCarloHistory'
import { loadMonteCarloAdvisorAssumptions } from '@/lib/monte-carlo/loadMonteCarloAdvisorAssumptions'
import { MonteCarloClient } from './_monte-carlo-client'

export const metadata = {
  title: 'Monte Carlo Simulations | Estate Planner',
  description: 'Probabilistic retirement outcome modeling',
}

export default async function MonteCarloPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!hasFeatureAccess('monte-carlo', access.tier, access.isAdvisor, access.isTrial)) {
    const householdContext = await loadUpgradeBannerHouseholdContext(supabase, user.id)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--mwm-navy)]">Monte Carlo</h1>
        <UpgradeBanner
          requiredTier={featureUpgradeTier('monte-carlo')}
          moduleName="Monte Carlo"
          valueProposition="Model thousands of retirement scenarios and see how often outcomes reached your stated goal."
          householdContext={householdContext}
        />
      </div>
    )
  }

  const [prefill, history, advisorAssumptions] = await Promise.all([
    loadMonteCarloPrefill(user.id),
    loadMonteCarloHistory(user.id),
    loadMonteCarloAdvisorAssumptions(supabase, user.id),
  ])

  return (
    <MonteCarloClient
      initialPrefill={prefill}
      initialHistory={history}
      initialAdvisorAssumptions={advisorAssumptions}
    />
  )
}

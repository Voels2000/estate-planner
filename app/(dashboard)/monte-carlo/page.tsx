// ─────────────────────────────────────────
// Menu: Retirement Planning > Monte Carlo
// Route: /monte-carlo
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
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

  if (access.tier < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Monte Carlo</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Monte Carlo"
          valueProposition="Run probability-of-success simulations across thousands of retirement scenarios."
        />
      </div>
    )
  }

  return <MonteCarloClient />
}

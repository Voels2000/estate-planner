import { createClient } from '@/lib/supabase/server'
import { loadTier0Dashboard } from '@/lib/dashboard/loadTier0Dashboard'
import { Tier0DashboardClient } from './_tier0-dashboard-client'

type HouseholdRow = {
  id: string
  owner_id: string
}

/**
 * Tier 0 dashboard server slice (PR 3). Separate loader — never enters the heavy
 * dashboard bundle or background recompute side effects.
 */
export async function Tier0DashboardBody({
  userId,
  userEmail,
}: {
  household: HouseholdRow
  userId: string
  userEmail: string
}) {
  const supabase = await createClient()
  const data = await loadTier0Dashboard(supabase, userId)

  return (
    <Tier0DashboardClient
      userName={data.profile?.full_name ?? userEmail}
      netWorth={data.netWorth}
      mortgageBalance={data.mortgageBalance}
      otherLiabilities={data.otherLiabilities}
    />
  )
}

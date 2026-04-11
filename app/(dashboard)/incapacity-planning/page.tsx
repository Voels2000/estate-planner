// ─────────────────────────────────────────
// Menu: Estate Planning > Incapacity Planning
// Route: /incapacity-planning
// ─────────────────────────────────────────

import { getUserAccess } from '@/lib/get-user-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import IncapacityPlanningDashboard from '@/components/IncapacityPlanningDashboard'

export default async function IncapacityPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Incapacity Planning</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Incapacity Planning"
          valueProposition="Confirm and track DPOA, Medical POA, Advance Directive, and Living Will."
        />
      </div>
    )
  }

  const { data: householdRow } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!householdRow?.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <IncapacityPlanningDashboard
        householdId={householdRow.id}
        userRole={access.isAdvisor ? 'advisor' : 'consumer'}
        consumerTier={access.tier}
      />
    </div>
  )
}

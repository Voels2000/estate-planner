// ─────────────────────────────────────────
// Menu: Retirement Planning > Social Security
// Route: /social-security
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import { SSClient } from './_ss-client'

export default async function SocialSecurityPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 2) {
    const { data: householdRow } = await supabase
      .from('households')
      .select('state_primary')
      .eq('owner_id', user.id)
      .single()
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Social Security</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Social Security"
          valueProposition="Model optimal claiming ages and spousal coordination strategy."
          householdContext={{
            grossEstate: null,
            statePrimary: householdRow?.state_primary ?? null,
            firstName: null,
          }}
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) redirect('/profile')

  return (
    <div className='max-w-7xl mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className="text-2xl font-bold text-neutral-900">Social Security</h1>
        <p className='text-sm text-neutral-500 mt-1'>
          Optimal claiming analysis and spousal coordination strategy
        </p>
      </div>
      <SSClient data={null} />
    </div>
  )
}

/**
 * Consumer dashboard (server shell).
 *
 * Resolves household + auth, then streams the heavy dashboard body via Suspense.
 *
 * Route: `/dashboard`
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardEmptyState } from './_components/DashboardEmptyState'
import { DashboardBody } from './_dashboard-body'
import DashboardLoading from './loading'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return <DashboardEmptyState />

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!household || householdError) {
    return <DashboardEmptyState />
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardBody
        household={household}
        userId={user.id}
        userEmail={user.email ?? ''}
      />
    </Suspense>
  )
}

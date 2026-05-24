import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

export type DashboardLayoutProfile = {
  role: string
  is_superuser: boolean
  subscription_status: string | null
  consumer_tier: number | null
  terms_accepted_at: string | null
  terms_version: string | null
  firm_id: string | null
  firm_role: string | null
  trial_started_at: string | null
  is_admin: boolean | null
  is_attorney: boolean | null
  onboarding_invite_advisor_completed_at: string | null
}

export type DashboardLayoutContext = {
  sessionUser: User
  user: { id: string; email: string }
  profile: DashboardLayoutProfile | null
  householdRow: {
    id: string
    state_primary: string | null
    filing_status: string | null
    person1_birth_year: number | null
  } | null
  unreadNotificationCount: number
  isSuperuser: boolean
}

// React cache() deduplicates this within a single request lifecycle.
// Middleware runs separately at the edge — it maintains its own getUser() call
// for MFA AAL check. That duplication is acceptable and cannot be eliminated
// without moving auth logic into the React render tree. Sprint P-2.
export const getDashboardLayoutContext = cache(async (): Promise<DashboardLayoutContext | null> => {
  const supabase = await createClient()
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser()

  if (!sessionUser) return null

  const [{ data: profile }, { data: householdRow }, { count: unreadNotificationCount }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select(
          'role, is_superuser, subscription_status, consumer_tier, terms_accepted_at, terms_version, firm_id, firm_role, trial_started_at, is_admin, is_attorney, onboarding_invite_advisor_completed_at',
        )
        .eq('id', sessionUser.id)
        .single(),
      supabase
        .from('households')
        .select('id, state_primary, filing_status, person1_birth_year')
        .eq('owner_id', sessionUser.id)
        .maybeSingle(),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', sessionUser.id)
        .eq('read', false),
    ])

  const isSuperuser = profile?.is_superuser === true

  return {
    sessionUser,
    user: { id: sessionUser.id, email: sessionUser.email ?? '' },
    profile: profile ?? null,
    householdRow: householdRow ?? null,
    unreadNotificationCount: unreadNotificationCount ?? 0,
    isSuperuser,
  }
})

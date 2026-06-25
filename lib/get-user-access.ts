import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { buildUserAccessFromProfile } from '@/lib/access/buildUserAccessFromProfile'
import { loadProfileForUserAccess } from '@/lib/access/loadProfileForUserAccess'
import type { UserAccess } from '@/lib/access/userAccess'
import { cache } from 'react'

export type { UserAccess } from '@/lib/access/userAccess'

export const getUserAccess = cache(async (): Promise<UserAccess> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      tier: 0,
      isAdvisor: false,
      isAdvisorClient: false,
      isAdmin: false,
      isTrial: false,
      subscriptionStatus: null,
      trialEndsAt: null,
    }
  }

  const admin = createAdminClient()
  const profile = await loadProfileForUserAccess(admin, user.id)

  const isAdvisor = profile?.role === 'advisor'
  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  return buildUserAccessFromProfile(profile, isAdvisorClient)
})

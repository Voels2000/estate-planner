import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConsumerTier } from '@/lib/tiers'
import { cache } from 'react'

export type UserAccess = {
  tier: number
  isAdvisor: boolean
  isAdvisorClient: boolean
  isAdmin: boolean
  isTrial: boolean
  subscriptionStatus: string | null
}

export const getUserAccess = cache(async (): Promise<UserAccess> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { tier: 0, isAdvisor: false, isAdvisorClient: false, isAdmin: false, isTrial: false, subscriptionStatus: null }
  }


  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, subscription_status, subscription_plan, consumer_tier, trial_start, is_admin, is_superuser')
    .eq('id', user.id)
    .single()

  // Superuser bypasses all subscription and tier checks.
  // Role is preserved (e.g. 'advisor') so primary identity is correct.
  if (profile?.is_superuser === true) {
    return {
      tier: 3,
      isAdvisor: profile.role === 'advisor',
      isAdvisorClient: false,
      isAdmin: true,
      isTrial: false,
      subscriptionStatus: 'active',
    }
  }

  const isAdvisor = profile?.role === 'advisor'
  const isAdmin = profile?.is_admin === true
  const subscriptionStatus = profile?.subscription_status ?? null
  const isTrial = subscriptionStatus === 'trialing'
  const isActive = subscriptionStatus === 'active' || isTrial
  const isAdvisorManaged = subscriptionStatus === 'advisor_managed'

  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .in('status', ['active', 'accepted'])
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  if (isAdvisor || isAdvisorClient || isAdvisorManaged) {
    return { tier: 3, isAdvisor, isAdvisorClient, isAdmin, isTrial, subscriptionStatus }
  }

  if (!isActive) {
    return { tier: 1, isAdvisor: false, isAdvisorClient: false, isAdmin: false, isTrial: false, subscriptionStatus }
  }

  const tier = resolveConsumerTier(
    profile?.subscription_plan ?? null,
    profile?.consumer_tier ?? null,
  )
  return { tier, isAdvisor, isAdvisorClient, isAdmin, isTrial, subscriptionStatus }
})

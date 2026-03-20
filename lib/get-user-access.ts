import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConsumerTier } from '@/lib/tiers'

export type UserAccess = {
  tier: number
  isAdvisor: boolean
  isAdvisorClient: boolean
  isTrial: boolean
  subscriptionStatus: string | null
}

export async function getUserAccess(): Promise<UserAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { tier: 0, isAdvisor: false, isAdvisorClient: false, isTrial: false, subscriptionStatus: null }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, subscription_status, subscription_plan, consumer_tier, trial_start')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'
  const subscriptionStatus = profile?.subscription_status ?? null
  const isTrial = subscriptionStatus === 'trialing'
  const isActive = subscriptionStatus === 'active' || isTrial

  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  if (isAdvisor || isAdvisorClient) {
    return { tier: 3, isAdvisor, isAdvisorClient, isTrial, subscriptionStatus }
  }

  if (!isActive) {
    return { tier: 1, isAdvisor: false, isAdvisorClient: false, isTrial: false, subscriptionStatus }
  }

  const tier = resolveConsumerTier(
    profile?.subscription_plan ?? null,
    profile?.consumer_tier ?? null,
  )
  return { tier, isAdvisor, isAdvisorClient, isTrial, subscriptionStatus }
}

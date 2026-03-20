import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, subscription_plan, consumer_tier, trial_start')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'
  const subscriptionStatus = profile?.subscription_status ?? null
  const isTrial = subscriptionStatus === 'trialing'
  const isActive = subscriptionStatus === 'active' || isTrial

  // Check advisor client
  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  console.log('GET_USER_ACCESS profile:', JSON.stringify({ role: profile?.role, status: profile?.subscription_status, tier: profile?.consumer_tier, userId: user.id }))
  // Advisors and advisor clients get full access
  if (isAdvisor || isAdvisorClient) {
    return { tier: 3, isAdvisor, isAdvisorClient, isTrial, subscriptionStatus }
  }

  if (!isActive) {
    return { tier: 0, isAdvisor: false, isAdvisorClient: false, isTrial: false, subscriptionStatus }
  }

  const tier = resolveConsumerTier(
    profile?.subscription_plan ?? null,
    profile?.consumer_tier ?? null,
  )

  return { tier, isAdvisor, isAdvisorClient, isTrial, subscriptionStatus }
}

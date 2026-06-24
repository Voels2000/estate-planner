import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { isManagedSubscriptionStatus } from '@/lib/billing/b2b2cBillingPolicy'
import {
  resolveConsumerIsTrial,
  resolveEffectiveTier,
} from '@/lib/access/resolveEffectiveTier'
import { cache } from 'react'

export type UserAccess = {
  /** Effective feature tier (0–3) — single source via resolveEffectiveTier. */
  tier: number
  isAdvisor: boolean
  isAdvisorClient: boolean
  isAdmin: boolean
  isTrial: boolean
  subscriptionStatus: string | null
  /** App-managed trial end or Stripe period end for banner display. */
  trialEndsAt: string | null
}

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
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'role, subscription_status, subscription_plan, consumer_tier, trial_ends_at, has_ever_subscribed, subscription_period_end, is_admin, is_superuser',
    )
    .eq('id', user.id)
    .single()

  if (profile?.is_superuser === true) {
    return {
      tier: 3,
      isAdvisor: profile.role === 'advisor',
      isAdvisorClient: false,
      isAdmin: true,
      isTrial: false,
      subscriptionStatus: 'active',
      trialEndsAt: null,
    }
  }

  const isAdvisor = profile?.role === 'advisor'
  const isAdmin = profile?.is_admin === true
  const subscriptionStatus = profile?.subscription_status ?? null
  const isProfessionallyManaged = isManagedSubscriptionStatus(subscriptionStatus)

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

  const tier = resolveEffectiveTier(
    {
      role: profile?.role,
      consumer_tier: profile?.consumer_tier,
      subscription_status: subscriptionStatus,
      subscription_plan: profile?.subscription_plan,
      trial_ends_at: profile?.trial_ends_at,
      has_ever_subscribed: profile?.has_ever_subscribed,
      is_superuser: profile?.is_superuser,
    },
    {
      isAdvisor,
      isAdvisorClient,
      isProfessionallyManaged,
    },
  )

  const isTrial = resolveConsumerIsTrial(
    {
      trial_ends_at: profile?.trial_ends_at,
      has_ever_subscribed: profile?.has_ever_subscribed,
    },
    subscriptionStatus,
  )

  const trialEndsAt =
    subscriptionStatus === 'trialing' && profile?.subscription_period_end
      ? profile.subscription_period_end
      : profile?.trial_ends_at ?? null

  return {
    tier,
    isAdvisor,
    isAdvisorClient,
    isAdmin,
    isTrial,
    subscriptionStatus,
    trialEndsAt,
  }
})

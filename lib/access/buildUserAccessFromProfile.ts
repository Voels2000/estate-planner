import {
  resolveConsumerIsTrial,
  resolveEffectiveTier,
} from '@/lib/access/resolveEffectiveTier'
import { isManagedSubscriptionStatus } from '@/lib/billing/b2b2cBillingPolicy'
import type { UserAccess } from '@/lib/access/userAccess'

export const PROFILE_FOR_ACCESS_SELECT =
  'role, subscription_status, subscription_plan, consumer_tier, trial_ends_at, has_ever_subscribed, subscription_period_end, is_admin, is_superuser'

export type ProfileForAccess = {
  role: string | null
  subscription_status: string | null
  subscription_plan: string | null
  consumer_tier: number | null
  trial_ends_at: string | null
  has_ever_subscribed: boolean | null
  subscription_period_end: string | null
  is_admin: boolean | null
  is_superuser: boolean | null
}

/** Map a loaded profile row (+ advisor-client flag) to effective access. */
export function buildUserAccessFromProfile(
  profile: ProfileForAccess | null,
  isAdvisorClient: boolean,
): UserAccess {
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
}

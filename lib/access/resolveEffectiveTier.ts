import { resolveConsumerTier, TRIAL_TIER } from '@/lib/tiers'

export type EffectiveTier = 0 | 1 | 2 | 3

export type EffectiveTierProfile = {
  role?: string | null
  consumer_tier?: number | null
  subscription_status?: string | null
  subscription_plan?: string | null
  trial_ends_at?: string | null
  has_ever_subscribed?: boolean | null
  is_superuser?: boolean | null
}

export type EffectiveTierContext = {
  isAdvisor: boolean
  isAdvisorClient: boolean
  isProfessionallyManaged: boolean
  /** Test injection */
  now?: Date
}

export function isActiveConsumerSubscription(
  subscriptionStatus: string | null | undefined,
): boolean {
  return (
    subscriptionStatus === 'active' ||
    subscriptionStatus === 'canceling' ||
    subscriptionStatus === 'trialing'
  )
}

export function isAppManagedTrialActive(
  profile: Pick<EffectiveTierProfile, 'trial_ends_at' | 'has_ever_subscribed'>,
  now: Date = new Date(),
): boolean {
  if (profile.has_ever_subscribed) return false
  if (!profile.trial_ends_at) return false
  return new Date(profile.trial_ends_at).getTime() > now.getTime()
}

function clampPaidTier(tier: number): 1 | 2 | 3 {
  if (tier <= 1) return 1
  if (tier === 2) return 2
  return 3
}

/**
 * Single source of truth for consumer feature tier (0–3).
 * Evaluation order is load-bearing — see docs/TIER_RESTRUCTURE_PR_SEQUENCE.md.
 */
export function resolveEffectiveTier(
  profile: EffectiveTierProfile,
  ctx: EffectiveTierContext,
): EffectiveTier {
  if (profile.is_superuser === true) return 3

  if (ctx.isAdvisor || ctx.isAdvisorClient) return 3

  if (ctx.isProfessionallyManaged) {
    const stored = profile.consumer_tier
    if (stored != null && stored >= 1 && stored <= 3) {
      return stored as 1 | 2 | 3
    }
    return 3
  }

  const status = profile.subscription_status ?? null
  if (isActiveConsumerSubscription(status)) {
    return clampPaidTier(
      resolveConsumerTier(profile.subscription_plan ?? null, profile.consumer_tier ?? null),
    )
  }

  if (profile.has_ever_subscribed === true) {
    return 0
  }

  const now = ctx.now ?? new Date()
  if (isAppManagedTrialActive(profile, now)) {
    return TRIAL_TIER
  }

  return 0
}

export function resolveConsumerIsTrial(
  profile: EffectiveTierProfile,
  subscriptionStatus: string | null,
  now: Date = new Date(),
): boolean {
  if (subscriptionStatus === 'trialing') return true
  if (profile.has_ever_subscribed) return false
  if (!isAppManagedTrialActive(profile, now)) return false
  return !isActiveConsumerSubscription(subscriptionStatus)
}

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Roles that must never receive a post-cancel deletion schedule (plan upgrade path). */
export const UPGRADED_PROFILE_ROLES = new Set([
  'advisor',
  'financial_advisor',
  'attorney',
  'admin',
])

const KEEPABLE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
])

export function isUpgradedProfileRole(role: string | null | undefined): boolean {
  return !!role && UPGRADED_PROFILE_ROLES.has(role)
}

/**
 * True when the Stripe customer still has another subscription that should
 * block deletion scheduling (e.g. consumer → advisor plan change on same customer).
 */
export function customerHasOtherKeepableSubscription(
  subscriptions: Stripe.Subscription[],
  deletedSubscriptionId: string,
): boolean {
  return subscriptions.some(
    (sub) =>
      sub.id !== deletedSubscriptionId &&
      KEEPABLE_SUBSCRIPTION_STATUSES.has(sub.status),
  )
}

export async function listCustomerSubscriptions(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    limit: 20,
  })
  return subs.data
}

export type SkipDeletionScheduleReason =
  | 'active_subscription_exists'
  | 'upgraded_role'
  | null

/**
 * Business rule: do not schedule WCPA deletion when cancellation is a plan change.
 */
export async function getSkipDeletionScheduleReason(params: {
  stripe: Stripe
  stripeCustomerId: string
  deletedSubscriptionId: string
  profileRole: string | null | undefined
}): Promise<SkipDeletionScheduleReason> {
  const { stripe, stripeCustomerId, deletedSubscriptionId, profileRole } = params

  if (isUpgradedProfileRole(profileRole)) {
    return 'upgraded_role'
  }

  const subscriptions = await listCustomerSubscriptions(stripe, stripeCustomerId)
  if (customerHasOtherKeepableSubscription(subscriptions, deletedSubscriptionId)) {
    return 'active_subscription_exists'
  }

  return null
}

/**
 * Second safety layer in cron before executing a scheduled deletion.
 * Returns a cancel_reason string for deletion_schedule, or null to proceed.
 */
export async function getCancelScheduledDeletionReason(params: {
  stripe: Stripe
  admin: SupabaseClient
  userId: string
  stripeCustomerId: string | null
}): Promise<string | null> {
  const { stripe, admin, userId, stripeCustomerId } = params

  const { data: profile } = await admin
    .from('profiles')
    .select('role, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (isUpgradedProfileRole(profile?.role)) {
    return `role_is_${profile?.role}`
  }

  const customerId = stripeCustomerId ?? profile?.stripe_customer_id
  if (!customerId) return null

  const subscriptions = await listCustomerSubscriptions(stripe, customerId)
  if (
    subscriptions.some((sub) => KEEPABLE_SUBSCRIPTION_STATUSES.has(sub.status))
  ) {
    return 'active_subscription_exists'
  }

  return null
}

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isUpgradedProfileRole,
  listCustomerSubscriptions,
} from '@/lib/compliance/deletionGuards'

const DELETION_GRACE_DAYS = 30

const ACTIVE_CONSUMER_STATUSES = new Set(['active', 'trialing'])
const ACTIVE_FIRM_STATUSES = new Set(['active', 'trialing', 'canceling', 'past_due'])

export type ScheduleAccountDeletionBlockReason =
  | 'upgraded_role'
  | 'active_subscription'
  | 'active_firm_subscription'

export type ScheduleAccountDeletionResult =
  | {
      ok: true
      scheduled: true
      deletes_at: string
      already_scheduled: boolean
    }
  | {
      ok: false
      reason: ScheduleAccountDeletionBlockReason
      message: string
    }

function addDays(from: Date, days: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

function computeScheduledFor(params: {
  subscriptionStatus: string | null | undefined
  subscriptionPeriodEnd: string | null | undefined
}): Date {
  const { subscriptionStatus, subscriptionPeriodEnd } = params
  if (
    subscriptionStatus === 'canceling' &&
    subscriptionPeriodEnd &&
    !Number.isNaN(new Date(subscriptionPeriodEnd).getTime())
  ) {
    return addDays(new Date(subscriptionPeriodEnd), DELETION_GRACE_DAYS)
  }
  return addDays(new Date(), DELETION_GRACE_DAYS)
}

/**
 * Schedule self-serve account deletion via the existing deletion_schedule cron path.
 */
export async function scheduleUserAccountDeletion(params: {
  admin: SupabaseClient
  stripe: Stripe
  userId: string
  email: string
  profile: {
    role: string | null | undefined
    subscription_status: string | null | undefined
    subscription_period_end: string | null | undefined
    stripe_customer_id: string | null | undefined
    firm_role: string | null | undefined
  }
}): Promise<ScheduleAccountDeletionResult> {
  const { admin, stripe, userId, email, profile } = params

  if (isUpgradedProfileRole(profile.role)) {
    return {
      ok: false,
      reason: 'upgraded_role',
      message:
        'Advisor, attorney, and admin accounts cannot be self-deleted here. Email privacy@mywealthmaps.com for assistance.',
    }
  }

  if (profile.firm_role === 'owner') {
    const { data: ownedFirm } = await admin
      .from('firms')
      .select('subscription_status')
      .eq('owner_id', userId)
      .maybeSingle()

    if (
      ownedFirm &&
      ACTIVE_FIRM_STATUSES.has(ownedFirm.subscription_status ?? '')
    ) {
      return {
        ok: false,
        reason: 'active_firm_subscription',
        message:
          'Your firm subscription is billed separately. Cancel firm billing first, then return here to delete your account.',
      }
    }
  }

  if (
    profile.subscription_status &&
    ACTIVE_CONSUMER_STATUSES.has(profile.subscription_status)
  ) {
    return {
      ok: false,
      reason: 'active_subscription',
      message:
        'Cancel your subscription at Billing first. After your billing period ends, you can schedule account deletion here (data is removed 30 days after closure).',
    }
  }

  if (profile.stripe_customer_id) {
    const subscriptions = await listCustomerSubscriptions(
      stripe,
      profile.stripe_customer_id,
    )
    if (
      subscriptions.some(
        (sub) => sub.status === 'active' || sub.status === 'trialing',
      )
    ) {
      return {
        ok: false,
        reason: 'active_subscription',
        message:
          'Cancel your subscription at Billing first. After your billing period ends, you can schedule account deletion here (data is removed 30 days after closure).',
      }
    }
  }

  const { data: existing } = await admin
    .from('deletion_schedule')
    .select('scheduled_for')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing?.scheduled_for) {
    return {
      ok: true,
      scheduled: true,
      deletes_at: existing.scheduled_for,
      already_scheduled: true,
    }
  }

  const scheduledFor = computeScheduledFor({
    subscriptionStatus: profile.subscription_status,
    subscriptionPeriodEnd: profile.subscription_period_end,
  })

  const { error } = await admin.from('deletion_schedule').insert({
    user_id: userId,
    email,
    reason: 'user_request',
    scheduled_for: scheduledFor.toISOString(),
    stripe_customer_id: profile.stripe_customer_id,
    scheduled_by: userId,
    status: 'pending',
  })

  if (error) {
    throw new Error(error.message)
  }

  return {
    ok: true,
    scheduled: true,
    deletes_at: scheduledFor.toISOString(),
    already_scheduled: false,
  }
}

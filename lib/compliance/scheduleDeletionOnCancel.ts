import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSkipDeletionScheduleReason } from '@/lib/compliance/deletionGuards'

const DELETION_GRACE_DAYS = 30

/**
 * Schedule 30-day post-cancellation deletion unless this is a plan change / role upgrade.
 */
export async function scheduleDeletionOnSubscriptionCancelled(params: {
  stripe: Stripe
  admin: SupabaseClient
  subscription: Stripe.Subscription
}): Promise<void> {
  const { stripe, admin, subscription } = params
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (!customerId) {
    console.log('[webhook] subscription.deleted — no customer id, skip deletion schedule')
    return
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!profile) {
    console.log('[webhook] subscription.deleted — no profile for customer, skip deletion schedule')
    return
  }

  const skipReason = await getSkipDeletionScheduleReason({
    stripe,
    stripeCustomerId: customerId,
    deletedSubscriptionId: subscription.id,
    profileRole: profile.role,
  })

  if (skipReason === 'active_subscription_exists') {
    console.log(
      '[webhook] Subscription deleted but active sub exists — skipping deletion schedule',
    )
    return
  }

  if (skipReason === 'upgraded_role') {
    console.log(
      `[webhook] Role is ${profile.role} — skipping deletion schedule`,
    )
    return
  }

  const scheduledFor = new Date()
  scheduledFor.setDate(scheduledFor.getDate() + DELETION_GRACE_DAYS)

  const { error } = await admin.from('deletion_schedule').insert({
    user_id: profile.id,
    email: profile.email,
    reason: 'subscription_cancelled',
    scheduled_for: scheduledFor.toISOString(),
    stripe_customer_id: customerId,
    scheduled_by: 'system',
    status: 'pending',
  })

  if (error) {
    console.error('[webhook] Failed to insert deletion_schedule:', error.message)
    return
  }

  console.log(
    `[webhook] Scheduled deletion for ${profile.email} on ${scheduledFor.toISOString()}`,
  )
}

/**
 * Cancel pending deletions when subscription is reactivated before grace period ends.
 */
export async function cancelPendingDeletionOnReactivation(params: {
  admin: SupabaseClient
  stripeCustomerId: string
}): Promise<void> {
  const { admin, stripeCustomerId } = params

  const { error } = await admin
    .from('deletion_schedule')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'subscription_reactivated',
    })
    .eq('stripe_customer_id', stripeCustomerId)
    .eq('status', 'pending')

  if (error) {
    console.error(
      '[webhook] Failed to cancel pending deletion_schedule:',
      error.message,
    )
  }
}

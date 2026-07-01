import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { withHasEverSubscribed } from '@/lib/access/hasEverSubscribed'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { isAttorneyConnectionCheckoutPrice } from '@/lib/billing/resolveAttorneyCheckout'
import { attorneyConnectionLimitSeedFromCheckoutQuantity } from '@/lib/billing/attorneyBillableQuantity'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

export type AttorneyListingCheckoutUpdate = {
  client_limit?: number
  billing_floor?: number
}

export type AttorneyProfileCheckoutUpdate = {
  stripe_subscription_id: string
  subscription_status: 'active'
  stripe_customer_id: string
  subscription_plan: string | null
  subscription_period_end?: string
}

export function buildAttorneyListingCheckoutCompletedUpdate(opts: {
  stripeQuantity: number
  priceId: string | null | undefined
}): AttorneyListingCheckoutUpdate {
  if (
    isConnectionBillingEnabled() &&
    opts.priceId &&
    isAttorneyConnectionCheckoutPrice(opts.priceId)
  ) {
    const seed = attorneyConnectionLimitSeedFromCheckoutQuantity(opts.stripeQuantity)
    return {
      client_limit: seed.client_limit,
      billing_floor: seed.billing_floor,
    }
  }
  return {}
}

export function buildAttorneyProfileCheckoutFields(
  subscription: Stripe.Subscription,
  stripeCustomerId: string,
  priceId: string | null,
): AttorneyProfileCheckoutUpdate {
  const renewalIso = subscriptionPeriodEndIso(subscription)
  return withHasEverSubscribed({
    stripe_subscription_id: subscription.id,
    subscription_status: 'active',
    stripe_customer_id: stripeCustomerId,
    subscription_plan: priceId,
    ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
  })
}

/** Fields allowed on subscription.updated — never seeds or lowers listing floor. */
export function buildAttorneySubscriptionUpdatedProfileUpdate(opts: {
  mappedStatus: string
  priceId: string | null | undefined
}): Record<string, string> {
  const update: Record<string, string> = {
    subscription_status: opts.mappedStatus,
  }
  if (opts.priceId) {
    update.subscription_plan = opts.priceId
  }
  return update
}

export async function applyAttorneyListingCheckoutCompletedUpdate(
  supabase: SupabaseClient,
  listingId: string,
  update: AttorneyListingCheckoutUpdate,
): Promise<{ error?: string }> {
  if (!update.client_limit && update.billing_floor === undefined) {
    return {}
  }
  const { error } = await supabase
    .from('attorney_listings')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (error) return { error: error.message }
  return {}
}

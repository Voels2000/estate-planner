import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { withHasEverSubscribed } from '@/lib/access/hasEverSubscribed'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'
import { getTierFromPriceId } from '@/lib/billing/stripePrices'
import { getAttorneyTierFromPriceId } from '@/lib/tiers'

export type ConsumerActivationFields = {
  subscription_status: string
  stripe_customer_id: string
  stripe_subscription_id: string
  subscription_plan: string | null
  consumer_tier?: number
  attorney_tier?: number
  subscription_period_end?: string
  has_ever_subscribed?: boolean
}

export function buildConsumerActivationFields(
  subscription: Stripe.Subscription,
  stripeCustomerId: string,
): ConsumerActivationFields | null {
  const subscriptionStatus = mapConsumerSubscriptionStatus(subscription)
  if (subscriptionStatus === 'none') {
    return null
  }

  const priceId = subscription.items.data[0]?.price.id ?? null
  const consumerTier = priceId ? getTierFromPriceId(priceId) : null
  const attorneyTier = priceId ? getAttorneyTierFromPriceId(priceId) : 0
  const renewalIso = subscriptionPeriodEndIso(subscription)

  return withHasEverSubscribed({
    subscription_status: subscriptionStatus,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscription.id,
    subscription_plan: priceId,
    ...(consumerTier ? { consumer_tier: consumerTier } : {}),
    ...(attorneyTier > 0 ? { attorney_tier: attorneyTier } : {}),
    ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
  })
}

export async function activateConsumerProfileFromSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription,
  stripeCustomerId: string,
): Promise<{ error: PostgrestError | null; fields: ConsumerActivationFields | null }> {
  const fields = buildConsumerActivationFields(subscription, stripeCustomerId)
  if (!fields) {
    return { error: null, fields: null }
  }

  const { error } = await supabase.from('profiles').update(fields).eq('id', userId)
  return { error, fields }
}

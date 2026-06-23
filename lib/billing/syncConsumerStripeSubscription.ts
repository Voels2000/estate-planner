import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getTierFromPriceId } from '@/lib/billing/stripePrices'
import { getAttorneyTierFromPriceId } from '@/lib/tiers'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

export type StripeSyncResult = {
  subscription_status: string
  consumer_tier: number
  subscription_plan: string | null
  subscription_period_end: string | null
  attorney_tier?: number
  stripe_subscription_id?: string | null
}

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing'])

export async function syncConsumerStripeSubscription(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
): Promise<{ before: StripeSyncResult; after: StripeSyncResult }> {
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select(
      'id, stripe_customer_id, subscription_status, consumer_tier, subscription_plan, subscription_period_end, attorney_tier, stripe_subscription_id',
    )
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    throw new Error('User not found')
  }

  if (!profile.stripe_customer_id) {
    throw new Error('No Stripe customer on record for this user')
  }

  const before: StripeSyncResult = {
    subscription_status: profile.subscription_status ?? 'none',
    consumer_tier: profile.consumer_tier ?? 1,
    subscription_plan: profile.subscription_plan ?? null,
    subscription_period_end: profile.subscription_period_end ?? null,
    attorney_tier: profile.attorney_tier ?? 0,
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
  }

  const customer = await stripe.customers.retrieve(profile.stripe_customer_id, {
    expand: ['subscriptions'],
  })

  if (customer.deleted) {
    throw new Error('Stripe customer was deleted')
  }

  const subscriptions =
    typeof customer.subscriptions === 'object' && customer.subscriptions?.data
      ? customer.subscriptions.data
      : []

  const activeSub = subscriptions.find((sub) => ACTIVE_STATUSES.has(sub.status)) ?? null

  let update: Record<string, unknown>

  if (!activeSub) {
    update = {
      subscription_status: 'none',
      consumer_tier: 1,
      subscription_plan: null,
      subscription_period_end: null,
      stripe_subscription_id: null,
    }
  } else {
    const { data: managedRows } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', profile.stripe_customer_id)
      .in('subscription_status', ['advisor_managed', 'attorney_managed'])
      .limit(1)

    if (managedRows?.length) {
      throw new Error('Cannot sync — profile is advisor/attorney managed (B2B2C)')
    }

    const renewalIso = subscriptionPeriodEndIso(activeSub)
    const priceId = activeSub.items.data[0]?.price.id ?? null
    const consumerTier = priceId ? getTierFromPriceId(priceId) : null
    const attorneyTier = priceId ? getAttorneyTierFromPriceId(priceId) : 0

    update = {
      subscription_status: mapConsumerSubscriptionStatus(activeSub),
      ...(renewalIso != null ? { subscription_period_end: renewalIso } : {}),
      stripe_subscription_id: activeSub.id,
      ...(priceId ? { subscription_plan: priceId } : {}),
      ...(consumerTier ? { consumer_tier: consumerTier } : {}),
      ...(attorneyTier > 0 ? { attorney_tier: attorneyTier } : {}),
    }
  }

  const { error: updateErr } = await admin.from('profiles').update(update).eq('id', userId)
  if (updateErr) {
    throw new Error(updateErr.message)
  }

  const after: StripeSyncResult = {
    subscription_status: (update.subscription_status as string) ?? before.subscription_status,
    consumer_tier: (update.consumer_tier as number) ?? (consumerTierFromUpdate(update) ?? before.consumer_tier),
    subscription_plan: (update.subscription_plan as string | null) ?? null,
    subscription_period_end: (update.subscription_period_end as string | null) ?? null,
    attorney_tier: (update.attorney_tier as number | undefined) ?? before.attorney_tier,
    stripe_subscription_id: (update.stripe_subscription_id as string | null) ?? null,
  }

  return { before, after }
}

function consumerTierFromUpdate(update: Record<string, unknown>): number | undefined {
  if ('consumer_tier' in update && typeof update.consumer_tier === 'number') {
    return update.consumer_tier
  }
  return undefined
}

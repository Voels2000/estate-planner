import { createAdminClient } from '@/lib/supabase/admin'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveAttorneyStickyFloorBillableQuantity } from '@/lib/billing/attorneyConnectionStickyFloor'
import { createStripeClient } from '@/lib/stripe/config'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

export async function resolveAttorneyStripeBillableQuantity(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string,
): Promise<number> {
  if (!isConnectionBillingEnabled()) {
    return 0
  }
  return resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
}

async function cancelAttorneySubscriptionAtPeriodEnd(
  stripe: ReturnType<typeof createStripeClient>,
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  subId: string,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subId)
  if (!sub.cancel_at_period_end) {
    await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    })
  }

  const renewalIso = subscriptionPeriodEndIso(sub)
  await admin
    .from('profiles')
    .update({
      subscription_status: 'canceling',
      ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  console.log('syncAttorneyStripeQuantity: scheduled cancel at period end (billable 0)', {
    profileId,
    subId,
  })
}

export async function syncAttorneyStripeQuantity(listingId: string): Promise<void> {
  try {
    const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
    const admin = createAdminClient()

    const { data: listing, error: listingError } = await admin
      .from('attorney_listings')
      .select('profile_id')
      .eq('id', listingId)
      .maybeSingle()

    if (listingError || !listing?.profile_id) {
      if (listingError) console.error('syncAttorneyStripeQuantity listing fetch:', listingError)
      return
    }

    const profileId = listing.profile_id

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', profileId)
      .maybeSingle()

    if (profileError) {
      console.error('syncAttorneyStripeQuantity profile fetch:', profileError)
      return
    }

    const subId = profile?.stripe_subscription_id?.trim()
    if (!subId) {
      return
    }

    const quantity = await resolveAttorneyStripeBillableQuantity(admin, listingId)

    if (quantity < 1) {
      await cancelAttorneySubscriptionAtPeriodEnd(stripe, admin, profileId, subId)
      return
    }

    const sub = await stripe.subscriptions.retrieve(subId)
    const existingItemId = sub.items.data[0]?.id
    if (!existingItemId) {
      console.error('syncAttorneyStripeQuantity: no subscription item for', subId)
      return
    }

    if (sub.cancel_at_period_end) {
      await stripe.subscriptions.update(subId, {
        cancel_at_period_end: false,
      })
      await admin
        .from('profiles')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
    }

    await stripe.subscriptions.update(subId, {
      items: [{ id: existingItemId, quantity }],
    })
    console.log('syncAttorneyStripeQuantity: Stripe quantity synced', {
      listingId,
      quantity,
      connectionBilling: isConnectionBillingEnabled(),
      subId,
    })
  } catch (err) {
    console.error('syncAttorneyStripeQuantity:', err)
  }
}

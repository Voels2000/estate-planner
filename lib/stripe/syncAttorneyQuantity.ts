import { createAdminClient } from '@/lib/supabase/admin'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveAttorneyStickyFloorBillableQuantity } from '@/lib/billing/attorneyConnectionStickyFloor'
import { createStripeClient } from '@/lib/stripe/config'

export async function resolveAttorneyStripeBillableQuantity(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string,
): Promise<number> {
  if (!isConnectionBillingEnabled()) {
    return 0
  }
  return resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
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

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', listing.profile_id)
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
      return
    }

    const sub = await stripe.subscriptions.retrieve(subId)
    const existingItemId = sub.items.data[0]?.id
    if (!existingItemId) {
      console.error('syncAttorneyStripeQuantity: no subscription item for', subId)
      return
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

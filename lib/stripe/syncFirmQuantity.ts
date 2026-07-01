import { createAdminClient } from '@/lib/supabase/admin'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveFirmStickyFloorBillableQuantity } from '@/lib/billing/firmConnectionStickyFloor'
import { createStripeClient } from '@/lib/stripe/config'

/** Billable Stripe quantity for a firm subscription item. Flag-off: seat_count (legacy). */
export async function resolveFirmStripeBillableQuantity(
  admin: ReturnType<typeof createAdminClient>,
  firmId: string,
  seatCount: number | null | undefined,
): Promise<number> {
  if (!isConnectionBillingEnabled()) {
    return seatCount ?? 1
  }
  return resolveFirmStickyFloorBillableQuantity(admin, firmId)
}

export async function syncFirmStripeQuantity(firmId: string): Promise<void> {
  try {
    const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
    const admin = createAdminClient()
    const { data: firm, error } = await admin
      .from('firms')
      .select('seat_count, stripe_subscription_id')
      .eq('id', firmId)
      .maybeSingle()

    if (error) {
      console.error('syncFirmStripeQuantity firm fetch:', error)
      return
    }

    const subId = firm?.stripe_subscription_id?.trim()
    if (!subId) {
      return
    }

    const quantity = await resolveFirmStripeBillableQuantity(admin, firmId, firm?.seat_count)
    const sub = await stripe.subscriptions.retrieve(subId)
    const existingItemId = sub.items.data[0]?.id
    if (!existingItemId) {
      console.error('syncFirmStripeQuantity: no subscription item for', subId)
      return
    }

    await stripe.subscriptions.update(subId, {
      items: [{ id: existingItemId, quantity }],
    })
    console.log('syncFirmStripeQuantity: Stripe quantity synced', {
      firmId,
      quantity,
      connectionBilling: isConnectionBillingEnabled(),
      subId,
    })
  } catch (err) {
    console.error('syncFirmStripeQuantity:', err)
  }
}

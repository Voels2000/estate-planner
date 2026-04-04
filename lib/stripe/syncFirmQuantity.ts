import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function syncFirmStripeQuantity(firmId: string): Promise<void> {
  try {
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

    const seatCount = firm?.seat_count ?? 1
    const sub = await stripe.subscriptions.retrieve(subId)
    const existingItemId = sub.items.data[0]?.id
    if (!existingItemId) {
      console.error('syncFirmStripeQuantity: no subscription item for', subId)
      return
    }

    await stripe.subscriptions.update(subId, {
      items: [{ id: existingItemId, quantity: seatCount }],
    })
    console.log('syncFirmStripeQuantity: Stripe quantity synced', {
      firmId,
      seatCount,
      subId,
    })
  } catch (err) {
    console.error('syncFirmStripeQuantity:', err)
  }
}

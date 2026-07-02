import type { SupabaseClient } from '@supabase/supabase-js'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { connectionLimitSeedFromCheckoutQuantity } from '@/lib/billing/firmConnectionStickyFloor'
import { isAdvisorConnectionCheckoutPrice } from '@/lib/billing/resolveAdvisorFirmCheckout'

export type FirmCheckoutCompletedUpdate = {
  stripe_subscription_id: string
  subscription_status: 'active'
  seat_count: number
  tier?: string
  client_limit?: number
  billing_floor?: number
}

/**
 * Build firm row update for checkout.session.completed only.
 * Seeds client_limit + billing_floor on initial connection checkout — never on subscription.updated.
 */
export function buildFirmCheckoutCompletedUpdate(opts: {
  subscriptionId: string
  stripeQuantity: number
  priceId: string | null | undefined
  firmTier?: string
}): FirmCheckoutCompletedUpdate {
  const update: FirmCheckoutCompletedUpdate = {
    stripe_subscription_id: opts.subscriptionId,
    subscription_status: 'active',
    seat_count: opts.stripeQuantity,
  }
  if (opts.firmTier) {
    update.tier = opts.firmTier
  }
  if (
    isConnectionBillingEnabled() &&
    opts.priceId &&
    isAdvisorConnectionCheckoutPrice(opts.priceId)
  ) {
    const seed = connectionLimitSeedFromCheckoutQuantity(opts.stripeQuantity)
    update.client_limit = seed.client_limit
    update.billing_floor = seed.billing_floor
  }
  return update
}

/** Fields allowed on customer.subscription.updated for firm subs (never seeds or lowers floor). */
export function buildFirmSubscriptionUpdatedUpdate(opts: {
  mappedStatus: string
  stripeQuantity: number
  stripePriceId: string | null | undefined
  firmTier?: string
}): Record<string, string | number> {
  const update: Record<string, string | number> = {
    subscription_status: opts.mappedStatus,
  }
  if (opts.firmTier) {
    update.tier = opts.firmTier
  }
  // Legacy per-seat: mirror Stripe quantity into seat_count.
  // Connection billing: seat_count is roster-only; do not mirror billable qty from Stripe.
  const connectionPrice =
    isConnectionBillingEnabled() &&
    opts.stripePriceId &&
    isAdvisorConnectionCheckoutPrice(opts.stripePriceId)
  if (!connectionPrice) {
    update.seat_count = opts.stripeQuantity
  }
  return update
}

export async function applyFirmCheckoutCompletedUpdate(
  supabase: SupabaseClient,
  firmId: string,
  update: FirmCheckoutCompletedUpdate,
): Promise<{ ownerId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('firms')
    .update(update)
    .eq('id', firmId)
    .select('owner_id')

  if (error) {
    return { error: error.message }
  }
  return { ownerId: data?.[0]?.owner_id as string | undefined }
}

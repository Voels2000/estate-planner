import Stripe from 'stripe'

/**
 * Single pinned Stripe API version — all server Stripe clients must use this.
 * Runtime sends this exact string to Stripe; do not revert to acacia when SDK types lag.
 */
export const STRIPE_API_VERSION = '2026-02-25.clover' as const

export function createStripeClient(apiKey: string): Stripe {
  // stripe npm types may only list older LatestApiVersion literals (e.g. acacia).
  // The cast is types-only — apiVersion at runtime is always STRIPE_API_VERSION above.
  // Remove the cast when stripe package ships Clover in LatestApiVersion.
  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  })
}

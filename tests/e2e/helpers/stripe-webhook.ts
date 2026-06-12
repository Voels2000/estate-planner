import Stripe from 'stripe'

/** Build a Stripe-Signature header for webhook constructEvent (test mode). */
export function signStripeWebhookPayload(payload: string, secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret })
}

export function buildStripeWebhookEvent(
  type: string,
  object: Record<string, unknown>,
  eventId?: string,
): string {
  return JSON.stringify({
    id: eventId ?? `evt_e2e_${Date.now()}`,
    object: 'event',
    type,
    data: { object },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  })
}

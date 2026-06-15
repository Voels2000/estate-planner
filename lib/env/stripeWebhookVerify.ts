import type { EnvFlag } from '@/lib/env/verifyEnv'

/** Canonical production webhook — www only (surfaces stale non-www duplicates). */
export const STRIPE_WEBHOOK_CANONICAL_PATH = 'www.mywealthmaps.com/api/stripe/webhook'

/** Events handled in app/api/stripe/webhook/route.ts (source of truth). */
export const STRIPE_WEBHOOK_REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.upcoming',
] as const

export type StripeWebhookRequiredEvent = (typeof STRIPE_WEBHOOK_REQUIRED_EVENTS)[number]
export type WebhookEventStatus = 'subscribed' | 'MISSING'

export interface StripeWebhookLiveness {
  endpoint_found: boolean
  endpoint_id?: string
  status?: string
  url?: string
  events: Record<StripeWebhookRequiredEvent, WebhookEventStatus>
  extra_events: string[]
  matching_endpoint_count: number
}

export type StripeWebhookEndpointLike = {
  id: string
  url: string
  status: string
  enabled_events: string[]
}

export function isCanonicalWebhookUrl(url: string): boolean {
  return url.includes(STRIPE_WEBHOOK_CANONICAL_PATH)
}

function isEventSubscribed(enabledEvents: string[], event: string): boolean {
  return enabledEvents.includes('*') || enabledEvents.includes(event)
}

export function analyzeStripeWebhookEndpoints(
  endpoints: StripeWebhookEndpointLike[],
): { webhook: StripeWebhookLiveness; flags: EnvFlag[]; liveFailReason?: string } {
  const flags: EnvFlag[] = []
  const emptyEvents = Object.fromEntries(
    STRIPE_WEBHOOK_REQUIRED_EVENTS.map((ev) => [ev, 'MISSING' as const]),
  ) as Record<StripeWebhookRequiredEvent, WebhookEventStatus>

  const matching = endpoints.filter((e) => isCanonicalWebhookUrl(e.url))

  if (matching.length === 0) {
    flags.push({
      name: 'STRIPE_WEBHOOK',
      level: 'CRITICAL',
      reason: `No webhook endpoint URL contains ${STRIPE_WEBHOOK_CANONICAL_PATH}.`,
      action: 'Point the production webhook at the canonical www URL in Stripe Dashboard.',
    })
    return {
      webhook: {
        endpoint_found: false,
        events: emptyEvents,
        extra_events: [],
        matching_endpoint_count: 0,
      },
      flags,
      liveFailReason: 'Stripe webhook endpoint not found for canonical URL',
    }
  }

  if (matching.length > 1) {
    flags.push({
      name: 'STRIPE_WEBHOOK',
      level: 'CRITICAL',
      reason: `${matching.length} webhook endpoints match ${STRIPE_WEBHOOK_CANONICAL_PATH} — ambiguous config (likely stale duplicate).`,
      action: 'Delete stale duplicate webhook endpoints in Stripe Dashboard; keep one www endpoint.',
    })
  }

  const endpoint = matching[0]
  const events = {} as Record<StripeWebhookRequiredEvent, WebhookEventStatus>
  const missingEvents: StripeWebhookRequiredEvent[] = []

  for (const ev of STRIPE_WEBHOOK_REQUIRED_EVENTS) {
    const subscribed = isEventSubscribed(endpoint.enabled_events, ev)
    events[ev] = subscribed ? 'subscribed' : 'MISSING'
    if (!subscribed) {
      missingEvents.push(ev)
      flags.push({
        name: `STRIPE_WEBHOOK_EVENT:${ev}`,
        level: 'CRITICAL',
        reason: `Production webhook is not subscribed to ${ev}.`,
        action: `Enable ${ev} on the canonical www webhook in Stripe Dashboard.`,
      })
    }
  }

  const requiredSet = new Set<string>(STRIPE_WEBHOOK_REQUIRED_EVENTS)
  const extra_events = endpoint.enabled_events.filter(
    (e) => e !== '*' && !requiredSet.has(e),
  )

  if (endpoint.status !== 'enabled') {
    flags.push({
      name: 'STRIPE_WEBHOOK',
      level: 'CRITICAL',
      reason: `Webhook endpoint status is "${endpoint.status}", not enabled.`,
      action: 'Re-enable the production webhook in Stripe Dashboard.',
    })
  }

  let liveFailReason: string | undefined
  if (missingEvents.length > 0) {
    liveFailReason = `Stripe webhook missing event(s): ${missingEvents.join(', ')}`
  } else if (endpoint.status !== 'enabled') {
    liveFailReason = `Stripe webhook endpoint status: ${endpoint.status}`
  } else if (matching.length > 1) {
    liveFailReason = 'Multiple Stripe webhook endpoints match canonical URL'
  }

  return {
    webhook: {
      endpoint_found: true,
      endpoint_id: endpoint.id,
      status: endpoint.status,
      url: endpoint.url,
      events,
      extra_events,
      matching_endpoint_count: matching.length,
    },
    flags,
    liveFailReason,
  }
}

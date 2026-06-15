/**
 * Stripe webhook endpoint analysis for verify-env ?live=1
 * Run: npx playwright test tests/unit/stripeWebhookVerify.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  STRIPE_WEBHOOK_CANONICAL_PATH,
  STRIPE_WEBHOOK_REQUIRED_EVENTS,
  analyzeStripeWebhookEndpoints,
  isCanonicalWebhookUrl,
} from '../../lib/env/stripeWebhookVerify'

const CANONICAL_URL = `https://${STRIPE_WEBHOOK_CANONICAL_PATH}`

test.describe('isCanonicalWebhookUrl', () => {
  test('matches www canonical path only', () => {
    expect(isCanonicalWebhookUrl(CANONICAL_URL)).toBe(true)
    expect(isCanonicalWebhookUrl('https://mywealthmaps.com/api/stripe/webhook')).toBe(false)
  })
})

test.describe('analyzeStripeWebhookEndpoints', () => {
  test('all required events subscribed → no liveFailReason', () => {
    const { webhook, flags, liveFailReason } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'enabled',
        enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS],
      },
    ])

    expect(webhook.endpoint_found).toBe(true)
    expect(webhook.matching_endpoint_count).toBe(1)
    for (const ev of STRIPE_WEBHOOK_REQUIRED_EVENTS) {
      expect(webhook.events[ev]).toBe('subscribed')
    }
    expect(flags.filter((f) => f.level === 'CRITICAL')).toHaveLength(0)
    expect(liveFailReason).toBeUndefined()
  })

  test('wildcard enabled_events satisfies all required', () => {
    const { webhook, liveFailReason } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'enabled',
        enabled_events: ['*'],
      },
    ])

    for (const ev of STRIPE_WEBHOOK_REQUIRED_EVENTS) {
      expect(webhook.events[ev]).toBe('subscribed')
    }
    expect(liveFailReason).toBeUndefined()
  })

  test('missing required event → CRITICAL flag + liveFailReason', () => {
    const { webhook, flags, liveFailReason } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'enabled',
        enabled_events: STRIPE_WEBHOOK_REQUIRED_EVENTS.filter(
          (e) => e !== 'invoice.upcoming',
        ),
      },
    ])

    expect(webhook.events['invoice.upcoming']).toBe('MISSING')
    expect(flags.some((f) => f.name === 'STRIPE_WEBHOOK_EVENT:invoice.upcoming')).toBe(true)
    expect(liveFailReason).toContain('invoice.upcoming')
  })

  test('no canonical endpoint → LIVE_FAIL reason', () => {
    const { webhook, liveFailReason } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_old',
        url: 'https://mywealthmaps.com/api/stripe/webhook',
        status: 'enabled',
        enabled_events: ['*'],
      },
    ])

    expect(webhook.endpoint_found).toBe(false)
    expect(webhook.matching_endpoint_count).toBe(0)
    expect(liveFailReason).toContain('not found')
  })

  test('multiple canonical endpoints → ambiguous liveFailReason', () => {
    const endpoints = [
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'enabled',
        enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS],
      },
      {
        id: 'we_2',
        url: `${CANONICAL_URL}?duplicate=1`,
        status: 'enabled',
        enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS],
      },
    ]
    const { webhook, liveFailReason } = analyzeStripeWebhookEndpoints(endpoints)
    expect(webhook.matching_endpoint_count).toBe(2)
    expect(liveFailReason).toContain('Multiple')
  })

  test('disabled endpoint status → liveFailReason', () => {
    const { liveFailReason } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'disabled',
        enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS],
      },
    ])
    expect(liveFailReason).toContain('disabled')
  })

  test('extra subscribed events are reported separately', () => {
    const { webhook } = analyzeStripeWebhookEndpoints([
      {
        id: 'we_1',
        url: CANONICAL_URL,
        status: 'enabled',
        enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS, 'customer.created'],
      },
    ])
    expect(webhook.extra_events).toContain('customer.created')
  })
})

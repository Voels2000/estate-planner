import { test, expect } from '@playwright/test'
import {
  buildStripeWebhookEvent,
  signStripeWebhookPayload,
} from '../helpers/stripe-webhook'

/**
 * Stripe webhook route smoke — no auth; uses STRIPE_WEBHOOK_SECRET when set.
 * Safe on production: signature failures + ignored event types only (no DB mutations).
 */
test.describe('@production', () => {
test.describe('Stripe webhook route', () => {
  test('POST /api/stripe/webhook rejects missing signature', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', {
      data: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid signature/i)
  })

  test('POST /api/stripe/webhook rejects invalid signature', async ({ request }) => {
    const payload = buildStripeWebhookEvent('customer.created', { id: 'cus_e2e_invalid' })
    const res = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=0,v1=deadbeef',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/stripe/webhook accepts signed noop event', async ({ request }) => {
    const secret =
      process.env.PLAYWRIGHT_STRIPE_WEBHOOK_SECRET?.trim() ??
      process.env.STRIPE_WEBHOOK_SECRET?.trim()
    test.skip(!secret, 'Set PLAYWRIGHT_STRIPE_WEBHOOK_SECRET for the deployment under test')

    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? '').replace(/\/$/, '')
    const isProductionTarget = baseUrl.includes('mywealthmaps.com')
    if (isProductionTarget && !process.env.PLAYWRIGHT_STRIPE_WEBHOOK_SECRET?.trim()) {
      test.skip(
        true,
        'Production webhook E2E requires PLAYWRIGHT_STRIPE_WEBHOOK_SECRET (not local STRIPE_WEBHOOK_SECRET from Stripe CLI)',
      )
    }

    const payload = buildStripeWebhookEvent('customer.created', {
      id: 'cus_e2e_noop',
      object: 'customer',
      email: 'e2e-webhook-noop@mywealthmaps.test',
    })
    const signature = signStripeWebhookPayload(payload, secret!)

    const res = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})
})

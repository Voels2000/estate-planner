import { test, expect } from '@playwright/test'
import { buildConsumerActivationFields } from '@/lib/stripe/activateConsumerSubscription'
import type Stripe from 'stripe'

test.describe('buildConsumerActivationFields', () => {
  test('skips activation when subscription is incomplete (none)', () => {
    const sub = {
      id: 'sub_incomplete',
      status: 'incomplete',
      cancel_at_period_end: false,
      cancel_at: null,
      items: {
        data: [{ price: { id: 'price_test' } }],
      },
    } as Stripe.Subscription

    expect(buildConsumerActivationFields(sub, 'cus_test')).toBeNull()
  })

  test('activates active subscription with item-level period', () => {
    const sub = {
      id: 'sub_active',
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: null,
      items: {
        data: [
          {
            price: { id: 'price_1ThDL4ENTkKmTNa35W90xTjk' },
            current_period_end: 1_800_000_000,
          },
        ],
      },
    } as unknown as Stripe.Subscription

    const fields = buildConsumerActivationFields(sub, 'cus_test')
    expect(fields?.subscription_status).toBe('active')
    expect(fields?.stripe_subscription_id).toBe('sub_active')
    expect(fields?.subscription_period_end).toBeTruthy()
  })
})

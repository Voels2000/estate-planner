import { test, expect } from '@playwright/test'
import {
  getSubscriptionPeriodEnd,
  subscriptionPeriodEndIso,
  unixToIsoOrNull,
} from '@/lib/stripe/subscriptionPeriod'
import type Stripe from 'stripe'

function basilSubscription(
  overrides: {
    itemPeriodEnd?: number
    topLevelPeriodEnd?: number
    omitPeriod?: boolean
  } = {},
): Stripe.Subscription {
  const itemPeriodEnd = overrides.omitPeriod
    ? undefined
    : (overrides.itemPeriodEnd ?? 1_700_000_000)
  return {
    id: 'sub_test',
    object: 'subscription',
    status: 'active',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test',
          object: 'subscription_item',
          current_period_end: itemPeriodEnd,
        } as unknown as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    current_period_end: overrides.topLevelPeriodEnd,
  } as Stripe.Subscription
}

test.describe('subscriptionPeriod Basil helpers', () => {
  test('reads period from subscription item (Basil shape)', () => {
    const end = 1_800_000_000
    expect(getSubscriptionPeriodEnd(basilSubscription({ itemPeriodEnd: end }))).toBe(end)
    expect(subscriptionPeriodEndIso(basilSubscription({ itemPeriodEnd: end }))).toBe(
      unixToIsoOrNull(end),
    )
  })

  test('falls back to top-level period when item missing', () => {
    const sub = {
      id: 'sub_test',
      object: 'subscription',
      status: 'active',
      current_period_end: 1_750_000_000,
      items: {
        object: 'list',
        data: [{ id: 'si_test', object: 'subscription_item' }],
        has_more: false,
        url: '/v1/subscription_items',
      },
    } as unknown as Stripe.Subscription
    expect(getSubscriptionPeriodEnd(sub)).toBe(1_750_000_000)
  })

  test('absent period returns null without throwing', () => {
    const sub = basilSubscription({ omitPeriod: true, topLevelPeriodEnd: undefined })
    expect(getSubscriptionPeriodEnd(sub)).toBeNull()
    expect(subscriptionPeriodEndIso(sub)).toBeNull()
  })

  test('unixToIsoOrNull rejects NaN and undefined', () => {
    expect(unixToIsoOrNull(undefined)).toBeNull()
    expect(unixToIsoOrNull(NaN)).toBeNull()
    expect(unixToIsoOrNull(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

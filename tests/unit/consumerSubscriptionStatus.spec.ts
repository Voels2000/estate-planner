import { test, expect } from '@playwright/test'
import { mapConsumerSubscriptionStatus } from '@/lib/stripe/consumerSubscriptionStatus'
import type Stripe from 'stripe'

function sub(
  overrides: Partial<{
    status: Stripe.Subscription.Status
    cancel_at_period_end: boolean
    cancel_at: number | null
  }> = {},
): Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end' | 'cancel_at'> {
  return {
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    ...overrides,
  }
}

test.describe('mapConsumerSubscriptionStatus', () => {
  test('active + cancel_at_period_end:true -> canceling', () => {
    expect(mapConsumerSubscriptionStatus(sub({ cancel_at_period_end: true }))).toBe('canceling')
  })

  test('active + cancel_at_period_end:false -> active', () => {
    expect(mapConsumerSubscriptionStatus(sub({ cancel_at_period_end: false }))).toBe('active')
  })

  test('active + omitted flag + future cancel_at -> canceling (live bug)', () => {
    const future = Math.floor(Date.now() / 1000) + 60 * 60 * 24
    expect(
      mapConsumerSubscriptionStatus(
        sub({ cancel_at_period_end: undefined as unknown as boolean, cancel_at: future }),
      ),
    ).toBe('canceling')
  })

  test('active + no cancel signals -> active', () => {
    expect(mapConsumerSubscriptionStatus(sub())).toBe('active')
  })

  test('active + past cancel_at -> active (stale)', () => {
    const past = Math.floor(Date.now() / 1000) - 60
    expect(mapConsumerSubscriptionStatus(sub({ cancel_at: past }))).toBe('active')
  })

  test('canceled -> canceled', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'canceled' }))).toBe('canceled')
  })

  test('trialing + cancel scheduled -> canceling', () => {
    expect(
      mapConsumerSubscriptionStatus(
        sub({ status: 'trialing', cancel_at_period_end: true }),
      ),
    ).toBe('canceling')
  })

  test('trialing -> trialing', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'trialing' }))).toBe('trialing')
  })

  test('past_due -> past_due', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'past_due' }))).toBe('past_due')
  })

  test('incomplete -> none', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'incomplete' }))).toBe('none')
  })

  test('incomplete_expired -> canceled', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'incomplete_expired' }))).toBe('canceled')
  })

  test('unpaid -> unpaid (schema + billing redirect)', () => {
    expect(mapConsumerSubscriptionStatus(sub({ status: 'unpaid' }))).toBe('unpaid')
  })
})

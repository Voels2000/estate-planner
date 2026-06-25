import { test, expect } from '@playwright/test'
import { shouldSetHasEverSubscribed, withHasEverSubscribed } from '@/lib/access/hasEverSubscribed'

test.describe('hasEverSubscribed', () => {
  test('active, canceling, and trialing mark subscribed', () => {
    expect(shouldSetHasEverSubscribed('active')).toBe(true)
    expect(shouldSetHasEverSubscribed('canceling')).toBe(true)
    expect(shouldSetHasEverSubscribed('trialing')).toBe(true)
  })

  test('none and canceled do not mark subscribed', () => {
    expect(shouldSetHasEverSubscribed('none')).toBe(false)
    expect(shouldSetHasEverSubscribed('canceled')).toBe(false)
  })

  test('withHasEverSubscribed merges flag on activation fields', () => {
    expect(
      withHasEverSubscribed({
        subscription_status: 'active',
        stripe_customer_id: 'cus_1',
      }),
    ).toEqual({
      subscription_status: 'active',
      stripe_customer_id: 'cus_1',
      has_ever_subscribed: true,
    })
  })
})

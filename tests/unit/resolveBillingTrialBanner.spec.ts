import { test, expect } from '@playwright/test'
import { resolveBillingTrialBanner } from '@/lib/billing/resolveBillingTrialBanner'

test.describe('resolveBillingTrialBanner', () => {
  test('app trial when trial_ends_at in future and not subscribed', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const state = resolveBillingTrialBanner({
      trialEndsAt: future,
      hasEverSubscribed: false,
      subscriptionStatus: 'none',
      subscriptionPeriodEnd: null,
    })
    expect(state).not.toBeNull()
    expect(state?.variant).toBe('calm')
  })

  test('urgent when ≤3 days remain', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const state = resolveBillingTrialBanner({
      trialEndsAt: future,
      hasEverSubscribed: false,
      subscriptionStatus: 'none',
      subscriptionPeriodEnd: null,
    })
    expect(state?.variant).toBe('urgent')
  })

  test('legacy Stripe trialing fallback', () => {
    const future = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
    const state = resolveBillingTrialBanner({
      trialEndsAt: null,
      hasEverSubscribed: false,
      subscriptionStatus: 'trialing',
      subscriptionPeriodEnd: future,
    })
    expect(state).not.toBeNull()
  })

  test('no banner after app trial ends', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const state = resolveBillingTrialBanner({
      trialEndsAt: past,
      hasEverSubscribed: false,
      subscriptionStatus: 'none',
      subscriptionPeriodEnd: null,
    })
    expect(state).toBeNull()
  })
})

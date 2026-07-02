import { test, expect } from '@playwright/test'
import {
  isAdvisorOwnPlanPath,
  resolveAdvisorPostLoginPath,
} from '@/lib/access/advisorBillingGate'

test.describe('advisorBillingGate', () => {
  test('own-plan paths include dashboard and profile, exclude advisor portal', () => {
    expect(isAdvisorOwnPlanPath('/dashboard')).toBe(true)
    expect(isAdvisorOwnPlanPath('/profile')).toBe(true)
    expect(isAdvisorOwnPlanPath('/assets')).toBe(true)
    expect(isAdvisorOwnPlanPath('/onboarding/wizard')).toBe(true)
    expect(isAdvisorOwnPlanPath('/advisor')).toBe(false)
    expect(isAdvisorOwnPlanPath('/advisor/firm')).toBe(false)
    expect(isAdvisorOwnPlanPath('/prospect/new')).toBe(false)
  })

  test('unpaid owner login lands on advisor portal; honors explicit redirectTo', () => {
    expect(
      resolveAdvisorPostLoginPath({
        redirectTo: '/dashboard',
        claimRedirect: null,
        firmRole: 'owner',
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
      }),
    ).toBe('/advisor')

    expect(
      resolveAdvisorPostLoginPath({
        redirectTo: '/profile',
        claimRedirect: null,
        firmRole: 'owner',
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
      }),
    ).toBe('/profile')
  })

  test('firm-paid owner login lands on advisor portal', () => {
    expect(
      resolveAdvisorPostLoginPath({
        redirectTo: '/dashboard',
        claimRedirect: null,
        firmRole: 'owner',
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: 'active',
      }),
    ).toBe('/advisor')
  })

  test('claim redirect takes precedence over billing state', () => {
    expect(
      resolveAdvisorPostLoginPath({
        redirectTo: '/dashboard',
        claimRedirect: '/claim/test-token',
        firmRole: 'owner',
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
      }),
    ).toBe('/claim/test-token')
  })
})

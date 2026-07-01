import { test, expect } from '@playwright/test'
import {
  isAdvisorOwnPlanPath,
  resolveAdvisorPostLoginPath,
  shouldRedirectAdvisorToBilling,
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

  test('unpaid advisor on own-plan path is not redirected', () => {
    expect(
      shouldRedirectAdvisorToBilling({
        isSuperuser: false,
        isFirmMember: false,
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
        pathname: '/dashboard',
      }),
    ).toBe(false)
  })

  test('unpaid advisor off own-plan path is redirected', () => {
    expect(
      shouldRedirectAdvisorToBilling({
        isSuperuser: false,
        isFirmMember: false,
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
        pathname: '/advisor',
      }),
    ).toBe(true)
  })

  test('firm-paid owner with null profile sub is not redirected', () => {
    expect(
      shouldRedirectAdvisorToBilling({
        isSuperuser: false,
        isFirmMember: false,
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: 'active',
        pathname: '/advisor',
      }),
    ).toBe(false)
  })

  test('unpaid owner login lands on dashboard or redirectTo', () => {
    expect(
      resolveAdvisorPostLoginPath({
        redirectTo: '/dashboard',
        claimRedirect: null,
        firmRole: 'owner',
        profileSubscriptionStatus: null,
        firmSubscriptionStatus: null,
      }),
    ).toBe('/dashboard')

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
})

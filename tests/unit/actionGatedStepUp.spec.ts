import { test, expect } from '@playwright/test'
import {
  isActionGatedStepUpEnabled,
  pathnameRequiresActionStepUp,
  userCompletedSecurityStepUp,
} from '../../lib/security/actionGatedStepUp'

test.describe('actionGatedStepUp', () => {
  const original = process.env.ACTION_GATED_PRIVILEGED_MFA

  test.afterEach(() => {
    if (original === undefined) {
      delete process.env.ACTION_GATED_PRIVILEGED_MFA
    } else {
      process.env.ACTION_GATED_PRIVILEGED_MFA = original
    }
  })

  test('is off by default', () => {
    delete process.env.ACTION_GATED_PRIVILEGED_MFA
    expect(isActionGatedStepUpEnabled()).toBe(false)
  })

  test('attorney client and request paths require step-up', () => {
    expect(pathnameRequiresActionStepUp('/attorney/clients/abc', { role: 'attorney' })).toBe(true)
    expect(pathnameRequiresActionStepUp('/attorney/requests', { role: 'attorney' })).toBe(true)
    expect(pathnameRequiresActionStepUp('/attorney', { role: 'attorney' })).toBe(false)
    expect(pathnameRequiresActionStepUp('/attorney/billing', { role: 'attorney' })).toBe(false)
  })

  test('advisor own-plan paths require step-up', () => {
    expect(pathnameRequiresActionStepUp('/dashboard', { role: 'advisor' })).toBe(true)
    expect(pathnameRequiresActionStepUp('/profile', { role: 'advisor' })).toBe(true)
    expect(pathnameRequiresActionStepUp('/advisor', { role: 'advisor' })).toBe(false)
  })

  test('security_step_up_at metadata marks completion', () => {
    expect(userCompletedSecurityStepUp({ user_metadata: {} })).toBe(false)
    expect(
      userCompletedSecurityStepUp({
        user_metadata: { security_step_up_at: '2026-07-01T00:00:00.000Z' },
      }),
    ).toBe(true)
  })
})

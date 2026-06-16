/**
 * Email confirmation gate helpers
 * Run: npx playwright test tests/unit/emailConfirmation.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  isEmailConfirmExemptPath,
  isEmailConfirmed,
} from '../../lib/auth/emailConfirmation'

test.describe('isEmailConfirmed', () => {
  test('requires email_confirmed_at timestamp', () => {
    expect(isEmailConfirmed(null)).toBe(false)
    expect(isEmailConfirmed({ email_confirmed_at: null })).toBe(false)
    expect(isEmailConfirmed({ email_confirmed_at: undefined })).toBe(false)
    expect(isEmailConfirmed({ email_confirmed_at: '2026-06-13T00:00:00.000Z' })).toBe(true)
  })
})

test.describe('isEmailConfirmExemptPath', () => {
  test('allows auth and login flows', () => {
    expect(isEmailConfirmExemptPath('/login')).toBe(true)
    expect(isEmailConfirmExemptPath('/auth/confirm-email')).toBe(true)
    expect(isEmailConfirmExemptPath('/auth/callback')).toBe(true)
    expect(isEmailConfirmExemptPath('/signup')).toBe(true)
  })

  test('blocks data surfaces', () => {
    expect(isEmailConfirmExemptPath('/dashboard')).toBe(false)
    expect(isEmailConfirmExemptPath('/api/stripe/checkout')).toBe(false)
  })
})

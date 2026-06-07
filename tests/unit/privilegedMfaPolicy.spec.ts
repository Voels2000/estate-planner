/**
 * Privileged MFA policy — env-gated until go-live
 * Run: npx playwright test tests/unit/privilegedMfaPolicy.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  isPrivilegedMfaEnforcementEnabled,
  profileRequiresPrivilegedMfa,
} from '../../lib/security/privilegedMfaPolicy'

test.describe('privilegedMfaPolicy', () => {
  const original = process.env.REQUIRE_PRIVILEGED_MFA

  test.afterEach(() => {
    if (original === undefined) {
      delete process.env.REQUIRE_PRIVILEGED_MFA
    } else {
      process.env.REQUIRE_PRIVILEGED_MFA = original
    }
  })

  test('is off by default for E2E and local dev', () => {
    delete process.env.REQUIRE_PRIVILEGED_MFA
    expect(isPrivilegedMfaEnforcementEnabled()).toBe(false)
  })

  test('enables when REQUIRE_PRIVILEGED_MFA=true', () => {
    process.env.REQUIRE_PRIVILEGED_MFA = 'true'
    expect(isPrivilegedMfaEnforcementEnabled()).toBe(true)
  })

  test('requires MFA for admin, advisor, attorney only', () => {
    expect(profileRequiresPrivilegedMfa({ role: 'consumer' })).toBe(false)
    expect(profileRequiresPrivilegedMfa({ role: 'advisor' })).toBe(true)
    expect(profileRequiresPrivilegedMfa({ role: 'attorney' })).toBe(true)
    expect(profileRequiresPrivilegedMfa({ is_admin: true })).toBe(true)
    expect(profileRequiresPrivilegedMfa({ is_superuser: true })).toBe(true)
  })
})

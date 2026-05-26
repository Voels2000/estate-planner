/**
 * Wizard layout gate — only redirect when profile is ready and household has zero data.
 * Run: npx playwright test tests/unit/wizard-onboarding-gate.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { shouldRequireWizardOnboarding } from '../../lib/onboarding/shouldRequireWizardOnboarding'

const base = {
  isSuperuser: false,
  role: 'consumer' as const,
  wizardComplete: false,
  wizardReady: true,
  hasAnyData: false,
}

test.describe('shouldRequireWizardOnboarding', () => {
  test('redirects first-time consumer with empty household', () => {
    expect(shouldRequireWizardOnboarding(base)).toBe(true)
  })

  test('does not redirect when user has any asset or income data', () => {
    expect(shouldRequireWizardOnboarding({ ...base, hasAnyData: true })).toBe(false)
  })

  test('does not redirect when wizard already complete', () => {
    expect(shouldRequireWizardOnboarding({ ...base, wizardComplete: true })).toBe(false)
  })

  test('does not redirect when profile not wizard-ready', () => {
    expect(shouldRequireWizardOnboarding({ ...base, wizardReady: false })).toBe(false)
  })

  test('does not redirect superusers or non-consumers', () => {
    expect(shouldRequireWizardOnboarding({ ...base, isSuperuser: true })).toBe(false)
    expect(shouldRequireWizardOnboarding({ ...base, role: 'advisor' })).toBe(false)
  })
})

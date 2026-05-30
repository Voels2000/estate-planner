/**
 * Guided onboarding href — onramp "Guide me through it" target.
 * Run: npx playwright test tests/unit/guided-onboarding-href.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  resolveGuidedOnboardingHref,
  shouldRedirectCompletedWizardToDashboard,
} from '../../lib/dashboard/guidedOnboardingHref'
import type { SetupProgressCounts } from '../../lib/consumer/setupProgressCounts'

const emptyProgress: SetupProgressCounts = {
  assets: 0,
  income: 0,
  expenses: 0,
  liabilities: 0,
  insurance: 0,
  hasAnyData: false,
}

const importedProgress: SetupProgressCounts = {
  assets: 3,
  income: 0,
  expenses: 0,
  liabilities: 0,
  insurance: 0,
  hasAnyData: true,
}

const coreCompleteProgress: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 0,
  liabilities: 0,
  insurance: 0,
  hasAnyData: true,
}

test.describe('resolveGuidedOnboardingHref', () => {
  test('no persona → persona screen', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: null,
        wizardCompletedAt: null,
        progress: emptyProgress,
      }),
    ).toBe('/onboarding/persona')
  })

  test('persona set, wizard incomplete → wizard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: null,
        progress: emptyProgress,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('wizard backfilled with assets only → resume wizard (not dashboard bounce)', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: importedProgress,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('wizard done, core steps complete → first missing section', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: coreCompleteProgress,
      }),
    ).toBe('/expenses')
  })
})

test.describe('shouldRedirectCompletedWizardToDashboard', () => {
  test('false when wizard flag set but income missing', () => {
    expect(
      shouldRedirectCompletedWizardToDashboard({
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: importedProgress,
      }),
    ).toBe(false)
  })

  test('true when assets and income both present', () => {
    expect(
      shouldRedirectCompletedWizardToDashboard({
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: coreCompleteProgress,
      }),
    ).toBe(true)
  })
})

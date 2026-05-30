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

const assetsIncomeOnly: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 0,
  liabilities: 0,
  insurance: 0,
  hasAnyData: true,
}

const missingLiabilities: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 1,
  liabilities: 0,
  insurance: 1,
  hasAnyData: true,
}

const missingExpenses: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 0,
  liabilities: 1,
  insurance: 1,
  hasAnyData: true,
}

const missingInsurance: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 1,
  liabilities: 1,
  insurance: 0,
  hasAnyData: true,
}

const allSectionsComplete: SetupProgressCounts = {
  assets: 1,
  income: 1,
  expenses: 1,
  liabilities: 1,
  insurance: 1,
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

  test('wizard backfilled with assets only → resume wizard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: importedProgress,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('wizard done, liabilities missing → wizard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: assetsIncomeOnly,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('wizard done, expenses missing → wizard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: missingExpenses,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('wizard done, insurance missing → wizard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: missingInsurance,
      }),
    ).toBe('/onboarding/wizard')
  })

  test('all five sections complete → dashboard', () => {
    expect(
      resolveGuidedOnboardingHref({
        onboardingPersona: 'accumulator',
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: allSectionsComplete,
      }),
    ).toBe('/dashboard')
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

  test('false when assets and income only', () => {
    expect(
      shouldRedirectCompletedWizardToDashboard({
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: assetsIncomeOnly,
      }),
    ).toBe(false)
  })

  test('false when liabilities missing', () => {
    expect(
      shouldRedirectCompletedWizardToDashboard({
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: missingLiabilities,
      }),
    ).toBe(false)
  })

  test('true when all five sections have data', () => {
    expect(
      shouldRedirectCompletedWizardToDashboard({
        wizardCompletedAt: '2026-05-29T00:00:00.000Z',
        progress: allSectionsComplete,
      }),
    ).toBe(true)
  })
})

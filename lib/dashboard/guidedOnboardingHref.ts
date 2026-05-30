import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'

/**
 * Target for DashboardOnramp "Guide me through it".
 *
 * - Wizard incomplete → persona first, then wizard.
 * - Wizard flag set but any section empty (e.g. import backfill) → resume wizard.
 * - All five data sections present → dashboard.
 */
export function resolveGuidedOnboardingHref(input: {
  onboardingPersona: string | null
  wizardCompletedAt: string | null
  progress: SetupProgressCounts
}): string {
  if (!input.wizardCompletedAt) {
    return input.onboardingPersona ? '/onboarding/wizard' : '/onboarding/persona'
  }

  if (
    input.progress.assets <= 0 ||
    input.progress.income <= 0 ||
    input.progress.liabilities <= 0 ||
    input.progress.expenses <= 0 ||
    input.progress.insurance <= 0
  ) {
    return '/onboarding/wizard'
  }

  return '/dashboard'
}

/** Wizard page sends users to dashboard only when all five data sections have rows. */
export function shouldRedirectCompletedWizardToDashboard(input: {
  wizardCompletedAt: string | null
  progress: SetupProgressCounts
}): boolean {
  if (!input.wizardCompletedAt) return false
  return (
    input.progress.assets > 0 &&
    input.progress.income > 0 &&
    input.progress.liabilities > 0 &&
    input.progress.expenses > 0 &&
    input.progress.insurance > 0
  )
}

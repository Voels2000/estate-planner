import type { SetupProgressCounts } from '@/lib/consumer/setupProgressCounts'

const FOUNDATION_SECTIONS: {
  key: 'expenses' | 'liabilities' | 'insurance'
  href: string
}[] = [
  { key: 'expenses', href: '/expenses' },
  { key: 'liabilities', href: '/liabilities' },
  { key: 'insurance', href: '/insurance' },
]

/**
 * Target for DashboardOnramp "Guide me through it".
 *
 * - Wizard incomplete → persona first, then wizard.
 * - Wizard flag set but assets/income still missing (e.g. import backfill) → resume wizard.
 * - Wizard core steps done → first incomplete financial section, else /assets.
 */
export function resolveGuidedOnboardingHref(input: {
  onboardingPersona: string | null
  wizardCompletedAt: string | null
  progress: SetupProgressCounts
}): string {
  if (!input.wizardCompletedAt) {
    return input.onboardingPersona ? '/onboarding/wizard' : '/onboarding/persona'
  }

  if (input.progress.assets <= 0 || input.progress.income <= 0) {
    return '/onboarding/wizard'
  }

  for (const section of FOUNDATION_SECTIONS) {
    if (input.progress[section.key] <= 0) {
      return section.href
    }
  }

  return '/assets'
}

/** Wizard page sends users to dashboard only when guided core steps are actually done. */
export function shouldRedirectCompletedWizardToDashboard(input: {
  wizardCompletedAt: string | null
  progress: SetupProgressCounts
}): boolean {
  if (!input.wizardCompletedAt) return false
  return input.progress.assets > 0 && input.progress.income > 0
}

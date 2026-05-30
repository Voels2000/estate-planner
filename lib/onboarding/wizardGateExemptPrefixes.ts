/** Routes that must not be redirected to /onboarding/wizard while onboarding is in progress. */
export const WIZARD_GATE_EXEMPT_PREFIXES = [
  '/onboarding/wizard',
  '/onboarding/persona',
  '/onboarding/invite-advisor',
  '/profile',
  '/billing',
  '/settings',
  '/login',
  '/import',
  '/dashboard',
  // Financial Planning — always accessible; users build data here
  '/assets',
  '/income',
  '/expenses',
  '/liabilities',
  '/real-estate',
  '/businesses',
  '/insurance',
  '/property-casualty',
  '/digital-assets',
  '/business-succession',
] as const

export function isWizardGateExemptPath(pathname: string): boolean {
  return WIZARD_GATE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

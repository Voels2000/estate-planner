/** Profile-level subs that bypass the advisor billing redirect. */
export const ACTIVE_ADVISOR_PROFILE_SUB_STATUSES = [
  'active',
  'trialing',
  'canceling',
] as const

/** Firm-level subs that bypass the advisor billing redirect (matches client-capacity gate). */
export const ACTIVE_ADVISOR_FIRM_SUB_STATUSES = ['active', 'trialing'] as const

/**
 * Paths an advisor may reach without profile or firm subscription — their own estate plan.
 * `/advisor` and `/prospect` are intentionally excluded; client roster requires firm billing.
 */
export const ADVISOR_OWN_PLAN_PATH_PREFIXES = [
  '/dashboard',
  '/profile',
  '/onboarding',
  '/settings',
  '/assets',
  '/income',
  '/expenses',
  '/scenarios',
  '/my-estate-strategy',
  '/my-estate-trust-strategy',
  '/estate-tax',
  '/trust-will',
  '/incapacity-planning',
  '/domicile-analysis',
  '/social-security',
  '/monte-carlo',
  '/allocation',
  '/asset-allocation',
  '/real-estate',
  '/businesses',
  '/business-succession',
  '/insurance',
  '/property-casualty',
  '/digital-assets',
  '/liabilities',
  '/projections',
  '/roth',
  '/rmd',
  '/health-check',
  '/titling',
  '/my-family',
  '/print',
  '/complete',
  '/unlock-estate',
  '/import',
] as const

export function isActiveAdvisorProfileSubscription(
  subscriptionStatus: string | null | undefined,
): boolean {
  return ACTIVE_ADVISOR_PROFILE_SUB_STATUSES.includes(
    subscriptionStatus as (typeof ACTIVE_ADVISOR_PROFILE_SUB_STATUSES)[number],
  )
}

export function isActiveAdvisorFirmSubscription(
  firmSubscriptionStatus: string | null | undefined,
): boolean {
  return ACTIVE_ADVISOR_FIRM_SUB_STATUSES.includes(
    firmSubscriptionStatus as (typeof ACTIVE_ADVISOR_FIRM_SUB_STATUSES)[number],
  )
}

export function isAdvisorOwnPlanPath(pathname: string): boolean {
  return ADVISOR_OWN_PLAN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function shouldRedirectAdvisorToBilling(input: {
  isSuperuser: boolean
  isFirmMember: boolean
  profileSubscriptionStatus: string | null | undefined
  firmSubscriptionStatus: string | null | undefined
  pathname: string
}): boolean {
  if (input.isSuperuser || input.isFirmMember) return false
  if (isActiveAdvisorProfileSubscription(input.profileSubscriptionStatus)) return false
  if (isActiveAdvisorFirmSubscription(input.firmSubscriptionStatus)) return false
  if (isAdvisorOwnPlanPath(input.pathname)) return false
  return true
}

/** Post-login destination for advisor accounts (SSR + client login must stay in sync). */
export function resolveAdvisorPostLoginPath(input: {
  redirectTo: string
  claimRedirect: string | null
  firmRole: string | null | undefined
  profileSubscriptionStatus: string | null | undefined
  firmSubscriptionStatus: string | null | undefined
}): string {
  if (input.claimRedirect) return input.claimRedirect
  if (input.firmRole === 'member') return '/advisor'
  if (
    isActiveAdvisorProfileSubscription(input.profileSubscriptionStatus) ||
    isActiveAdvisorFirmSubscription(input.firmSubscriptionStatus)
  ) {
    return '/advisor'
  }
  return input.redirectTo || '/dashboard'
}

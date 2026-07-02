/** Profile-level subs treated as paid for post-login routing helpers. */
export const ACTIVE_ADVISOR_PROFILE_SUB_STATUSES = [
  'active',
  'trialing',
  'canceling',
] as const

/** Firm-level subs treated as paid for post-login routing helpers. */
export const ACTIVE_ADVISOR_FIRM_SUB_STATUSES = ['active', 'trialing'] as const

/**
 * Consumer estate-plan paths advisors may use without firm connection billing.
 * Portal routes (`/advisor`, `/prospect`) are not listed — they are always reachable;
 * connect/invite is gated in API handlers (`getAdvisorClientCapacity`).
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

/** Post-login destination for advisor accounts (SSR + client login + auth/callback must stay in sync). */
export function resolveAdvisorPostLoginPath(input: {
  redirectTo: string
  claimRedirect: string | null
  firmRole?: string | null | undefined
  profileSubscriptionStatus?: string | null | undefined
  firmSubscriptionStatus?: string | null | undefined
}): string {
  if (input.claimRedirect) return input.claimRedirect
  if (input.redirectTo && input.redirectTo !== '/dashboard') return input.redirectTo
  return '/advisor'
}

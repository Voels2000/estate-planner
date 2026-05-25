/** Consumer routes from docs/CONSUMER_NAV_MAP.md — used for regression loads. */

export const CONSUMER_OVERVIEW_ROUTES = [
  { path: '/profile', heading: /profile|household/i },
  { path: '/dashboard', heading: /Good (morning|afternoon|evening)|Estate/i },
] as const

export const CONSUMER_FINANCIAL_ROUTES = [
  { path: '/income', heading: /income/i },
  { path: '/expenses', heading: /expense/i },
  { path: '/assets', heading: /asset/i },
  { path: '/real-estate', heading: /real estate/i },
  { path: '/businesses', heading: /business/i },
  { path: '/digital-assets', heading: /digital/i },
  { path: '/business-succession', heading: /succession|business/i },
  { path: '/liabilities', heading: /liabilit/i },
  { path: '/insurance', heading: /insurance/i },
  { path: '/property-casualty', heading: /property|casualty/i },
  { path: '/allocation', heading: /allocation/i },
  { path: '/projections', heading: /projection/i },
  { path: '/scenarios', heading: /scenario/i },
] as const

export const CONSUMER_RETIREMENT_ROUTES = [
  { path: '/social-security', heading: /social security/i },
  { path: '/rmd', heading: /rmd/i },
  { path: '/roth', heading: /roth/i },
  { path: '/complete', heading: /lifetime|snapshot|complete/i },
  { path: '/monte-carlo', heading: /monte carlo/i },
] as const

export const CONSUMER_ESTATE_ROUTES = [
  { path: '/my-family', heading: /family/i },
  { path: '/titling', heading: /titling|beneficiar/i },
  { path: '/incapacity-planning', heading: /incapacity/i },
  { path: '/domicile-analysis', heading: /domicile/i },
  { path: '/estate-tax', heading: /estate tax/i },
  { path: '/my-estate-strategy', heading: /Tax Horizons|Estate Value/i },
  {
    path: '/my-estate-trust-strategy?tab=trusts',
    heading: /gifting|strateg|trust/i,
  },
] as const

export const CONSUMER_LINKED_ROUTES = [
  { path: '/health-check', heading: /estate health|will|trust/i },
  { path: '/import', heading: /import/i },
  { path: '/print', heading: /export|print|estate plan/i },
  { path: '/my-advisor', heading: /advisor/i },
  { path: '/billing', heading: /all set|Choose your plan|Billing/i },
  { path: '/settings/security', heading: /security|privacy|password/i },
] as const

export const CONSUMER_ESTATE_TIER_ROUTES = [
  ...CONSUMER_ESTATE_ROUTES,
  { path: '/allocation', heading: /allocation/i },
  { path: '/digital-assets', heading: /digital/i },
  { path: '/business-succession', heading: /succession|business/i },
  { path: '/import', heading: /import/i },
] as const

export const PUBLIC_MARKETING_ROUTES = [
  { path: '/', heading: /wealth|estate|plan/i },
  { path: '/pricing', heading: /pricing|plan/i },
  { path: '/assess', heading: /assess|readiness|plan/i },
  { path: '/find-advisor', heading: /advisor/i },
  { path: '/find-attorney', heading: /attorney/i },
  { path: '/privacy', heading: /privacy/i },
  { path: '/terms', heading: /terms/i },
  { path: '/education', heading: /education|guide|module/i },
  { path: '/waitlist', heading: /launching soon|waitlist|Early access/i },
] as const

/** Smoke checklist “Quick regression” rows (profile via CONSUMER_OVERVIEW_ROUTES). */
export const QUICK_REGRESSION_ROUTES = [
  ...CONSUMER_OVERVIEW_ROUTES,
  { path: '/assets', heading: /asset/i },
  { path: '/liabilities', heading: /liabilit/i },
  { path: '/income', heading: /income/i },
  { path: '/expenses', heading: /expense/i },
  { path: '/real-estate', heading: /real estate/i },
  { path: '/projections', heading: /projection/i },
  { path: '/scenarios', heading: /scenario/i },
  { path: '/titling', heading: /titling|beneficiar/i },
  {
    path: '/my-estate-trust-strategy?tab=trusts',
    heading: /gifting|strateg|trust/i,
  },
] as const

export function dedupeRoutesByPath<T extends { path: string }>(routes: readonly T[]): T[] {
  const seen = new Set<string>()
  return routes.filter((route) => {
    if (seen.has(route.path)) return false
    seen.add(route.path)
    return true
  })
}

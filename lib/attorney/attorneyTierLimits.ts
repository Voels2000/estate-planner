/** Attorney B2B2C tier limits — Stripe price IDs configured manually in dashboard. */

export const ATTORNEY_TIER_LIMITS: Record<number, { maxClients: number; label: string }> = {
  0: { maxClients: 3, label: 'Free (read-only trial)' },
  1: { maxClients: 15, label: 'Attorney Starter' },
  2: { maxClients: 50, label: 'Attorney Growth' },
}

export function attorneyTierFeatures(tier: number) {
  return {
    intakeSummaryExport: tier >= 1,
    documentGapAlerts: tier >= 1,
    multiClientDocDashboard: tier >= 1,
    pdfBranding: tier >= 2,
    maxClients: ATTORNEY_TIER_LIMITS[tier]?.maxClients ?? 3,
  }
}

/** TODO: Create in Stripe Dashboard and set env vars:
 * STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY
 * STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY
 */

/** Attorney B2B2C tier limits — Stripe price IDs configured manually in dashboard. */

import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'

export const ATTORNEY_TIER_LIMITS: Record<number, { maxClients: number; label: string }> = {
  0: { maxClients: 3, label: 'Free (read-only trial)' },
  1: { maxClients: 15, label: 'Attorney Starter' },
  2: { maxClients: 50, label: 'Attorney Growth' },
}

export type AttorneyTierFeatures = {
  intakeSummaryExport: boolean
  documentGapAlerts: boolean
  multiClientDocDashboard: boolean
  pdfBranding: boolean
  maxClients: number
}

const UNIVERSAL_ATTORNEY_FEATURES: AttorneyTierFeatures = {
  intakeSummaryExport: true,
  documentGapAlerts: true,
  multiClientDocDashboard: true,
  pdfBranding: true,
  maxClients: Number.MAX_SAFE_INTEGER,
}

export function attorneyTierFeatures(tier: number): AttorneyTierFeatures {
  return {
    intakeSummaryExport: tier >= 1,
    documentGapAlerts: tier >= 1,
    multiClientDocDashboard: tier >= 1,
    pdfBranding: tier >= 2,
    maxClients: ATTORNEY_TIER_LIMITS[tier]?.maxClients ?? 3,
  }
}

/** Flag ON: universal features for every connected client. Flag OFF: legacy tier gates. */
export function resolveAttorneyTierFeatures(tier: number): AttorneyTierFeatures {
  if (isConnectionBillingEnabled()) {
    return UNIVERSAL_ATTORNEY_FEATURES
  }
  return attorneyTierFeatures(tier)
}

/** Flat universal intake cap when connection billing replaces tier-0 monthly limit. */
export const ATTORNEY_UNIVERSAL_INTAKE_MONTHLY_CAP = 5


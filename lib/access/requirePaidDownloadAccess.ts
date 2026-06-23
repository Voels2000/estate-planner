import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
  type DeliverableAccessProfile,
  type PlanExportPurchaseContext,
} from '@/lib/billing/planExportAccess'

export type DownloadAccessProfile = DeliverableAccessProfile

export type PaidDownloadAccessOptions = {
  /** Plan & Export purchase row — unlocks deliverable download; update only while window open. */
  planExportPurchase?: PlanExportPurchaseContext | null
  now?: Date
}

/** @deprecated Use hasDeliverableDownloadAccess for deliverable paths. */
export function hasPaidDownloadAccess(
  profile: DownloadAccessProfile,
  minimumTier: 1 | 2 | 3 = 1,
  options?: PaidDownloadAccessOptions,
): boolean {
  return hasDeliverableDownloadAccess(profile, minimumTier, options)
}

export { hasDeliverableDownloadAccess, hasDeliverableUpdateAccess }

import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

/** Days of plan editing included with Plan & Export — set once at fulfillment. */
export const PLAN_EXPORT_EDIT_WINDOW_DAYS = 90

/** In-app + email warning when this many days remain before the edit window locks. */
export const PLAN_EXPORT_FINAL_WARNING_DAYS = 14

export const PLAN_EXPORT_EMAIL_WARNING_THRESHOLDS = [14, 3] as const

export type PlanExportEmailWarningDays = (typeof PLAN_EXPORT_EMAIL_WARNING_THRESHOLDS)[number]

export function computePlanExportEditWindowEndsAt(purchasedAt: Date): Date {
  const ends = new Date(purchasedAt)
  ends.setUTCDate(ends.getUTCDate() + PLAN_EXPORT_EDIT_WINDOW_DAYS)
  return ends
}

export function isPlanExportEditWindowOpen(
  editWindowEndsAt: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() < new Date(editWindowEndsAt).getTime()
}

export function daysUntilPlanExportLock(
  editWindowEndsAt: string,
  now: Date = new Date(),
): number {
  const msRemaining = new Date(editWindowEndsAt).getTime() - now.getTime()
  return Math.ceil(msRemaining / (24 * 60 * 60 * 1000))
}

export function isWithinPlanExportFinalWarning(
  editWindowEndsAt: string,
  now: Date = new Date(),
): boolean {
  if (!isPlanExportEditWindowOpen(editWindowEndsAt, now)) return false
  return daysUntilPlanExportLock(editWindowEndsAt, now) <= PLAN_EXPORT_FINAL_WARNING_DAYS
}

/**
 * Which warning email (if any) is due for a purchase row. Checks 3-day before 14-day
 * so the urgent notice wins when both thresholds apply.
 */
export function planExportEmailWarningDue(
  editWindowEndsAt: string,
  warning14dSentAt: string | null,
  warning3dSentAt: string | null,
  now: Date = new Date(),
): PlanExportEmailWarningDays | null {
  if (!isPlanExportEditWindowOpen(editWindowEndsAt, now)) return null

  const daysRemaining = daysUntilPlanExportLock(editWindowEndsAt, now)

  if (daysRemaining <= 3 && !warning3dSentAt) return 3
  if (daysRemaining <= 14 && daysRemaining > 3 && !warning14dSentAt) return 14
  return null
}

export type DeliverableAccessProfile = {
  role: string | null
  consumer_tier: number | null
  subscription_status: string | null
}

export type PlanExportPurchaseContext = {
  editWindowEndsAt: string
}

function isActivePaidSubscriber(
  profile: DeliverableAccessProfile,
  minimumTier: 1 | 2 | 3,
): boolean {
  const tier = profile.consumer_tier ?? 1
  return profile.subscription_status === 'active' && tier >= minimumTier
}

/** State 1–3 download: active tier-3+ sub OR any completed Plan & Export purchase. */
export function hasDeliverableDownloadAccess(
  profile: DeliverableAccessProfile,
  minimumTier: 1 | 2 | 3 = DELIVERABLE_MIN_TIER,
  options?: {
    planExportPurchase?: PlanExportPurchaseContext | null
    now?: Date
  },
): boolean {
  if (profile.role !== 'consumer') return true

  if (minimumTier >= DELIVERABLE_MIN_TIER && options?.planExportPurchase) {
    return true
  }

  return isActivePaidSubscriber(profile, minimumTier)
}

/** State 1–2 update/generate: active tier-3+ sub OR Plan & Export within edit window. */
export function hasDeliverableUpdateAccess(
  profile: DeliverableAccessProfile,
  minimumTier: 1 | 2 | 3 = DELIVERABLE_MIN_TIER,
  options?: {
    planExportPurchase?: PlanExportPurchaseContext | null
    now?: Date
  },
): boolean {
  if (profile.role !== 'consumer') return true

  const now = options?.now ?? new Date()

  if (
    minimumTier >= DELIVERABLE_MIN_TIER &&
    options?.planExportPurchase &&
    isPlanExportEditWindowOpen(options.planExportPurchase.editWindowEndsAt, now)
  ) {
    return true
  }

  return isActivePaidSubscriber(profile, minimumTier)
}

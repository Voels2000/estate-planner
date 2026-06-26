/**
 * Faithful /print + export-estate-plan deliverable wiring for unit tests.
 * Loader row → toPlanExportPurchaseContext → hasDeliverableDownloadAccess → shouldOfferPlanAndExportPurchase.
 */
import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
} from '@/lib/access/requirePaidDownloadAccess'
import { computePlanExportEditWindowEndsAt } from '@/lib/billing/planExportAccess'
import {
  toPlanExportPurchaseContext,
  type OneTimePurchaseRow,
} from '@/lib/billing/oneTimePurchases'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { PLAN_AND_EXPORT_SKU } from '@/lib/billing/stripePrices'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

const defaultMidWindowNow = new Date('2026-06-15T12:00:00.000Z')

/** Faithful mock of getUserPlanExportPurchase() — completed row shape from one_time_purchases. */
export function mockCompletedPlanExportRow(
  purchasedAt: Date = new Date('2026-06-01T12:00:00.000Z'),
): OneTimePurchaseRow {
  return {
    id: 'otp-test-1',
    user_id: 'user-test',
    sku: PLAN_AND_EXPORT_SKU,
    stripe_checkout_session_id: 'cs_test_plan_export',
    stripe_payment_intent_id: 'pi_test_plan_export',
    amount_cents: 149_000,
    currency: 'usd',
    status: 'completed',
    credit_applied_at: null,
    purchased_at: purchasedAt.toISOString(),
    edit_window_ends_at: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    warning_14d_sent_at: null,
    warning_3d_sent_at: null,
    refund_ack_at: null,
    refund_ack_version: null,
    created_at: purchasedAt.toISOString(),
  }
}

/**
 * Mirrors export-estate-plan/route.ts + print/page.tsx after DB load:
 *   planExportPurchase = toPlanExportPurchaseContext(await getUserPlanExportPurchase(...))
 */
export function deliverableAccessOptionsFromLoaderRow(
  row: OneTimePurchaseRow | null,
  now: Date = defaultMidWindowNow,
) {
  const planExportPurchase = toPlanExportPurchaseContext(row)
  return { planExportPurchase, now }
}

export type DeliverableProfile = {
  role: string
  consumer_tier: number | null
  subscription_status: string | null
}

/** Full /print page deliverable wiring — loader row in, not hand-built gate flags. */
export function printPageDeliverableFlags(
  profile: DeliverableProfile,
  purchaseRow: OneTimePurchaseRow | null,
  now: Date = defaultMidWindowNow,
) {
  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier ?? 0,
    subscription_status: profile.subscription_status ?? 'none',
  }
  const accessOptions = deliverableAccessOptionsFromLoaderRow(purchaseRow, now)
  const canDownloadDeliverable = hasDeliverableDownloadAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
    accessOptions,
  )
  const canUpdateDeliverable = hasDeliverableUpdateAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
    accessOptions,
  )
  const showPlanAndExportOffer = shouldOfferPlanAndExportPurchase({
    profile: profileAccess,
    canDownloadDeliverable,
    isAdvisorClient: false,
  })
  return { canDownloadDeliverable, canUpdateDeliverable, showPlanAndExportOffer }
}

export function offerPlanAndExportWithGateWiring(
  profile: DeliverableProfile,
  purchaseRow: OneTimePurchaseRow | null,
  extras?: {
    isAdvisorClient?: boolean
    subscription_plan?: string | null
    now?: Date
  },
): boolean {
  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier ?? 0,
    subscription_status: profile.subscription_status ?? 'none',
  }
  const accessOptions = deliverableAccessOptionsFromLoaderRow(
    purchaseRow,
    extras?.now ?? defaultMidWindowNow,
  )
  const canDownloadDeliverable = hasDeliverableDownloadAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
    accessOptions,
  )
  return shouldOfferPlanAndExportPurchase({
    profile: profileAccess,
    canDownloadDeliverable,
    isAdvisorClient: extras?.isAdvisorClient ?? false,
    subscription_plan: extras?.subscription_plan,
  })
}

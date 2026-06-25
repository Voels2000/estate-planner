/**
 * PR 7 — Plan & Export deliverable four-cell matrix.
 *
 * Purchase context must be derived via toPlanExportPurchaseContext(loader row) —
 * same as print/page.tsx and export-estate-plan/route.ts after getUserPlanExportPurchase.
 *
 * Run: npx playwright test tests/unit/planExportAppTrialDeliverable.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { resolveEffectiveTier } from '@/lib/access/resolveEffectiveTier'
import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
} from '@/lib/access/requirePaidDownloadAccess'
import { computePlanExportEditWindowEndsAt } from '@/lib/billing/planExportAccess'
import {
  toPlanExportPurchaseContext,
  type OneTimePurchaseRow,
} from '@/lib/billing/oneTimePurchases'
import { PLAN_AND_EXPORT_SKU } from '@/lib/billing/stripePrices'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

const trialCtx = {
  isAdvisor: false,
  isAdvisorClient: false,
  isProfessionallyManaged: false,
  now: new Date('2026-06-01T12:00:00.000Z'),
}

const noSubConsumer = {
  role: 'consumer' as const,
  consumer_tier: 1,
  subscription_status: 'none' as const,
}

const appTrialStoredProfile = {
  ...noSubConsumer,
  consumer_tier: 0,
  trial_ends_at: '2030-01-01T00:00:00.000Z',
  has_ever_subscribed: false,
}

const activeTier3StoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 3,
  subscription_status: 'active' as const,
}

const midWindowNow = new Date('2026-06-15T12:00:00.000Z')

/** Faithful mock of getUserPlanExportPurchase() — completed row shape from one_time_purchases. */
function mockCompletedPlanExportRow(): OneTimePurchaseRow {
  const purchasedAt = new Date('2026-06-01T12:00:00.000Z')
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
    created_at: purchasedAt.toISOString(),
  }
}

/**
 * Mirrors export-estate-plan/route.ts + print/page.tsx after DB load:
 *   planExportPurchase = toPlanExportPurchaseContext(await getUserPlanExportPurchase(...))
 *   accessOptions = { planExportPurchase }
 */
function deliverableAccessOptionsFromLoaderRow(
  row: OneTimePurchaseRow | null,
  now: Date = midWindowNow,
) {
  const planExportPurchase = toPlanExportPurchaseContext(row)
  return { planExportPurchase, now }
}

/** Full /print page deliverable wiring — loader row in, not hand-built gate flags. */
function printPageDeliverableFlags(
  profile: {
    role: string
    consumer_tier: number | null
    subscription_status: string | null
  },
  purchaseRow: OneTimePurchaseRow | null,
) {
  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier ?? 0,
    subscription_status: profile.subscription_status ?? 'none',
  }
  const accessOptions = deliverableAccessOptionsFromLoaderRow(purchaseRow)
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

test.describe('PR 7 deliverable four-cell matrix', () => {
  test('cell 1 — app trial, no purchase: effective tier 3, PDF refused', () => {
    expect(resolveEffectiveTier(appTrialStoredProfile, trialCtx)).toBe(3)

    const profile = {
      role: appTrialStoredProfile.role,
      consumer_tier: appTrialStoredProfile.consumer_tier,
      subscription_status: appTrialStoredProfile.subscription_status,
    }
    const accessOptions = deliverableAccessOptionsFromLoaderRow(null)
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER, accessOptions)).toBe(false)
    expect(hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER, accessOptions)).toBe(false)
  })

  test('cell 2 — active tier-3 subscription: PDF download and update allowed', () => {
    expect(hasDeliverableDownloadAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER)).toBe(
      true,
    )
    expect(hasDeliverableUpdateAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER)).toBe(true)
  })

  test('cell 3 — Plan & Export purchaser, no active sub: loader row → toPlanExportPurchaseContext → allowed', () => {
    const noPurchaseOptions = deliverableAccessOptionsFromLoaderRow(null)
    expect(
      hasDeliverableDownloadAccess(noSubConsumer, DELIVERABLE_MIN_TIER, noPurchaseOptions),
      'getUserPlanExportPurchase returned null — same stored shape as trial',
    ).toBe(false)

    const loaderRow = mockCompletedPlanExportRow()
    const purchaserOptions = deliverableAccessOptionsFromLoaderRow(loaderRow)
    expect(toPlanExportPurchaseContext(loaderRow)).toEqual(purchaserOptions.planExportPurchase)

    expect(
      hasDeliverableDownloadAccess(noSubConsumer, DELIVERABLE_MIN_TIER, purchaserOptions),
      'route wiring: purchase context from loader, not a hand-built gate flag',
    ).toBe(true)
    expect(hasDeliverableUpdateAccess(noSubConsumer, DELIVERABLE_MIN_TIER, purchaserOptions)).toBe(
      true,
    )
  })

  test('cell 4 — app trial who also purchased: loader row unlocks despite non-active sub', () => {
    const profile = {
      role: appTrialStoredProfile.role,
      consumer_tier: appTrialStoredProfile.consumer_tier,
      subscription_status: appTrialStoredProfile.subscription_status,
    }
    const purchaserOptions = deliverableAccessOptionsFromLoaderRow(mockCompletedPlanExportRow())

    expect(
      hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER, deliverableAccessOptionsFromLoaderRow(null)),
    ).toBe(false)
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER, purchaserOptions)).toBe(true)
    expect(hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER, purchaserOptions)).toBe(true)
  })
})

test.describe('PR 7 /print wiring (loader row → toPlanExportPurchaseContext)', () => {
  test('app-trial, no purchase row: gated, offer shown', () => {
    const flags = printPageDeliverableFlags(appTrialStoredProfile, null)
    expect(flags.canDownloadDeliverable).toBe(false)
    expect(flags.canUpdateDeliverable).toBe(false)
    expect(flags.showPlanAndExportOffer).toBe(true)
  })

  test('active tier-3 subscriber: ungated, offer hidden', () => {
    const flags = printPageDeliverableFlags(activeTier3StoredProfile, null)
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })

  test('Plan & Export purchaser without sub: loader row unlocks, offer hidden', () => {
    const flags = printPageDeliverableFlags(noSubConsumer, mockCompletedPlanExportRow())
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })

  test('app-trial with loader purchase row: ungated, offer hidden', () => {
    const flags = printPageDeliverableFlags(appTrialStoredProfile, mockCompletedPlanExportRow())
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })
})

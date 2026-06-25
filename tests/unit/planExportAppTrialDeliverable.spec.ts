/**
 * PR 7 — Plan & Export deliverable four-cell matrix.
 *
 * Direct answer: hasDeliverableDownloadAccess is NOT subscription-only.
 * It ORs (1) completed Plan & Export purchase via options.planExportPurchase
 * before (2) isActivePaidSubscriber. Call sites must pass purchase context
 * (print page + export-estate-plan API do).
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

function openPlanExportPurchase() {
  const purchasedAt = new Date('2026-06-01T12:00:00.000Z')
  return {
    planExportPurchase: {
      editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    },
    now: new Date('2026-06-15T12:00:00.000Z'),
  }
}

/** Mirrors app/(dashboard)/print/page.tsx — stored profile + planExportPurchase from DB. */
function printPageDeliverableFlags(
  profile: {
    role: string
    consumer_tier: number | null
    subscription_status: string | null
  },
  planExportPurchase?: { editWindowEndsAt: string } | null,
) {
  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier ?? 0,
    subscription_status: profile.subscription_status ?? 'none',
  }
  const accessOptions = { planExportPurchase }
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
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER)).toBe(false)
    expect(hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER)).toBe(false)
  })

  test('cell 2 — active tier-3 subscription: PDF download and update allowed', () => {
    expect(hasDeliverableDownloadAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER)).toBe(
      true,
    )
    expect(hasDeliverableUpdateAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER)).toBe(true)
  })

  test('cell 3 — Plan & Export purchaser, no active sub: PDF allowed (purchase OR, not subscription-only)', () => {
    const purchase = openPlanExportPurchase()

    expect(
      hasDeliverableDownloadAccess(noSubConsumer, DELIVERABLE_MIN_TIER),
      'same stored shape as trial without purchase context — must not imply access',
    ).toBe(false)

    expect(
      hasDeliverableDownloadAccess(noSubConsumer, DELIVERABLE_MIN_TIER, purchase),
      'completed purchase unlocks download even when subscription_status is none',
    ).toBe(true)
    expect(hasDeliverableUpdateAccess(noSubConsumer, DELIVERABLE_MIN_TIER, purchase)).toBe(true)
  })

  test('cell 4 — app trial who also purchased: purchase wins over non-active subscription state', () => {
    const purchase = openPlanExportPurchase()
    const profile = {
      role: appTrialStoredProfile.role,
      consumer_tier: appTrialStoredProfile.consumer_tier,
      subscription_status: appTrialStoredProfile.subscription_status,
    }

    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER)).toBe(false)
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER, purchase)).toBe(true)
    expect(hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER, purchase)).toBe(true)
  })
})

test.describe('PR 7 /print wiring (includes planExportPurchase like production)', () => {
  test('app-trial, no purchase: gated, offer shown', () => {
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

  test('Plan & Export purchaser without sub: ungated, offer hidden (no double-sell)', () => {
    const purchase = openPlanExportPurchase().planExportPurchase
    const flags = printPageDeliverableFlags(noSubConsumer, purchase)
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })

  test('app-trial with purchase: ungated via purchase, offer hidden', () => {
    const purchase = openPlanExportPurchase().planExportPurchase
    const flags = printPageDeliverableFlags(appTrialStoredProfile, purchase)
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })
})

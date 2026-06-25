/**
 * PR 7 — Plan & Export deliverable: app-managed trial vs paid active subscriber.
 * Deliverable gates use stored profile fields (not resolveEffectiveTier).
 * Run: npx playwright test tests/unit/planExportAppTrialDeliverable.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { resolveEffectiveTier } from '@/lib/access/resolveEffectiveTier'
import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
} from '@/lib/access/requirePaidDownloadAccess'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

const trialCtx = {
  isAdvisor: false,
  isAdvisorClient: false,
  isProfessionallyManaged: false,
  now: new Date('2026-06-01T12:00:00.000Z'),
}

const appTrialStoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 0,
  subscription_status: 'none' as const,
  trial_ends_at: '2030-01-01T00:00:00.000Z',
  has_ever_subscribed: false,
}

const activeTier3StoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 3,
  subscription_status: 'active' as const,
}

/** Mirrors app/(dashboard)/print/page.tsx — stored fields only for deliverable gates. */
function printPageDeliverableFlags(profile: {
  role: string
  consumer_tier: number | null
  subscription_status: string | null
}) {
  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier ?? 0,
    subscription_status: profile.subscription_status ?? 'none',
  }
  const canDownloadDeliverable = hasDeliverableDownloadAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
  )
  const canUpdateDeliverable = hasDeliverableUpdateAccess(profileAccess, DELIVERABLE_MIN_TIER)
  const showPlanAndExportOffer = shouldOfferPlanAndExportPurchase({
    profile: profileAccess,
    canDownloadDeliverable,
    isAdvisorClient: false,
  })
  return { canDownloadDeliverable, canUpdateDeliverable, showPlanAndExportOffer }
}

test.describe('PR 7 app-managed trial vs paid deliverable', () => {
  test('mid-app-trial: effective tier 3 but PDF download and update refused', () => {
    expect(
      resolveEffectiveTier(appTrialStoredProfile, trialCtx),
      'Estate features use effective tier during app trial',
    ).toBe(3)

    const deliverableProfile = {
      role: appTrialStoredProfile.role,
      consumer_tier: appTrialStoredProfile.consumer_tier,
      subscription_status: appTrialStoredProfile.subscription_status,
    }
    expect(
      hasDeliverableDownloadAccess(deliverableProfile, DELIVERABLE_MIN_TIER),
      'deliverable uses stored fields — trial is not active subscription',
    ).toBe(false)
    expect(hasDeliverableUpdateAccess(deliverableProfile, DELIVERABLE_MIN_TIER)).toBe(false)
  })

  test('active tier-3 subscriber: PDF download and update allowed', () => {
    expect(
      hasDeliverableDownloadAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER),
    ).toBe(true)
    expect(hasDeliverableUpdateAccess(activeTier3StoredProfile, DELIVERABLE_MIN_TIER)).toBe(true)
  })

  test('/print wiring: app-trial user gated but Plan & Export offer shown', () => {
    const flags = printPageDeliverableFlags(appTrialStoredProfile)
    expect(flags.canDownloadDeliverable).toBe(false)
    expect(flags.canUpdateDeliverable).toBe(false)
    expect(flags.showPlanAndExportOffer).toBe(true)
  })

  test('/print wiring: active tier-3 subscriber ungated, offer hidden', () => {
    const flags = printPageDeliverableFlags(activeTier3StoredProfile)
    expect(flags.canDownloadDeliverable).toBe(true)
    expect(flags.canUpdateDeliverable).toBe(true)
    expect(flags.showPlanAndExportOffer).toBe(false)
  })
})

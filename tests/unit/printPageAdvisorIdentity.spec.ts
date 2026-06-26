import { test, expect } from '@playwright/test'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'
import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
} from '@/lib/access/requirePaidDownloadAccess'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'
import {
  mockCompletedPlanExportRow,
  printPageDeliverableFlags,
} from './helpers/printPageDeliverableWiring'

/** Mirrors print/page.tsx deliverable wiring after isAdvisorIdentity split. */
function printDeliverableFromRole(
  profile: {
    role: string
    consumer_tier: number
    subscription_status: string
  },
  purchaseRow: Parameters<typeof printPageDeliverableFlags>[1],
) {
  const advisorIdentity = isAdvisorIdentity(profile.role)
  const flags = printPageDeliverableFlags(profile, purchaseRow)
  return {
    advisorIdentity,
    canDownload: advisorIdentity || flags.canDownloadDeliverable,
    canUpdate: advisorIdentity || flags.canUpdateDeliverable,
    consumerGateOnly: flags,
  }
}

const noSubConsumer = {
  role: 'consumer' as const,
  consumer_tier: 1,
  subscription_status: 'none' as const,
}

const appTrialStoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 0,
  subscription_status: 'none' as const,
}

const activeTier3StoredProfile = {
  role: 'consumer' as const,
  consumer_tier: 3,
  subscription_status: 'active' as const,
}

test.describe('print page advisor identity vs deliverable gates (PR 7 alignment)', () => {
  test('superuser consumer role uses deliverable gates — not advisor bypass', () => {
    const profile = {
      role: 'consumer',
      consumer_tier: 3,
      subscription_status: 'active',
    }
    const result = printDeliverableFromRole(profile, null)
    expect(result.advisorIdentity).toBe(false)
    expect(result.canDownload).toBe(true)
    expect(result.canUpdate).toBe(true)
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER)).toBe(true)
  })

  test('advisor role identity bypasses consumer deliverable gates', () => {
    const profile = {
      role: 'advisor',
      consumer_tier: 0,
      subscription_status: 'none',
    }
    const result = printDeliverableFromRole(profile, null)
    expect(result.advisorIdentity).toBe(true)
    expect(result.canDownload).toBe(true)
    expect(result.canUpdate).toBe(true)
    expect(hasDeliverableDownloadAccess(profile, DELIVERABLE_MIN_TIER)).toBe(false)
  })

  test('consumer tier-1 without purchase stays gated', () => {
    const profile = {
      role: 'consumer',
      consumer_tier: 1,
      subscription_status: 'active',
    }
    const result = printDeliverableFromRole(profile, null)
    expect(result.advisorIdentity).toBe(false)
    expect(result.canDownload).toBe(false)
    expect(hasDeliverableUpdateAccess(profile, DELIVERABLE_MIN_TIER)).toBe(false)
  })
})

/**
 * PR 7 four consumer cells — prove isAdvisorIdentity branch does not shift consumer outcomes.
 * consumerGateOnly must match printPageDeliverableFlags (pre-refactor wiring) exactly;
 * page-level canDownload/canUpdate equals gates when role is consumer.
 */
test.describe('PR 7 consumer cells unchanged through print identity branch', () => {
  test('cell 1 — app trial, no purchase: consumer gates unchanged (gated, offer shown)', () => {
    const pr7 = printPageDeliverableFlags(appTrialStoredProfile, null)
    const withIdentity = printDeliverableFromRole(appTrialStoredProfile, null)

    expect(withIdentity.advisorIdentity).toBe(false)
    expect(withIdentity.consumerGateOnly).toEqual(pr7)
    expect(withIdentity.canDownload).toBe(pr7.canDownloadDeliverable)
    expect(withIdentity.canUpdate).toBe(pr7.canUpdateDeliverable)
    expect(pr7.canDownloadDeliverable).toBe(false)
    expect(pr7.canUpdateDeliverable).toBe(false)
    expect(pr7.showPlanAndExportOffer).toBe(true)
  })

  test('cell 2 — active tier-3 subscription: consumer gates unchanged (ungated)', () => {
    const pr7 = printPageDeliverableFlags(activeTier3StoredProfile, null)
    const withIdentity = printDeliverableFromRole(activeTier3StoredProfile, null)

    expect(withIdentity.consumerGateOnly).toEqual(pr7)
    expect(withIdentity.canDownload).toBe(true)
    expect(withIdentity.canUpdate).toBe(true)
    expect(pr7.showPlanAndExportOffer).toBe(false)
  })

  test('cell 3 — Plan & Export purchaser, no active sub: consumer gates unchanged', () => {
    const row = mockCompletedPlanExportRow()
    const pr7 = printPageDeliverableFlags(noSubConsumer, row)
    const withIdentity = printDeliverableFromRole(noSubConsumer, row)

    expect(withIdentity.consumerGateOnly).toEqual(pr7)
    expect(withIdentity.canDownload).toBe(true)
    expect(withIdentity.canUpdate).toBe(true)
    expect(pr7.showPlanAndExportOffer).toBe(false)
  })

  test('cell 4 — app trial with purchase row: consumer gates unchanged', () => {
    const row = mockCompletedPlanExportRow()
    const pr7 = printPageDeliverableFlags(appTrialStoredProfile, row)
    const withIdentity = printDeliverableFromRole(appTrialStoredProfile, row)

    expect(withIdentity.consumerGateOnly).toEqual(pr7)
    expect(withIdentity.canDownload).toBe(true)
    expect(withIdentity.canUpdate).toBe(true)
    expect(pr7.showPlanAndExportOffer).toBe(false)
  })
})

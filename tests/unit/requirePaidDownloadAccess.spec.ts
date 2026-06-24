/**
 * Plan & Export 3-state deliverable gate.
 * Run: npx playwright test tests/unit/requirePaidDownloadAccess.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
  hasPaidDownloadAccess,
} from '../../lib/access/requirePaidDownloadAccess'
import { canExportRawData } from '../../lib/billing/exportAccess'
import { computePlanExportEditWindowEndsAt } from '../../lib/billing/planExportAccess'

const consumer = {
  role: 'consumer' as const,
  consumer_tier: 1,
  subscription_status: 'none',
}

function purchaseWindowFromDayOne(): { editWindowEndsAt: string } {
  const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
  return { editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString() }
}

test.describe('hasDeliverableUpdateAccess', () => {
  test('tier 3 active → true', () => {
    expect(
      hasDeliverableUpdateAccess(
        { ...consumer, consumer_tier: 3, subscription_status: 'active' },
        3,
      ),
    ).toBe(true)
  })

  test('tier 3 trialing → false', () => {
    expect(
      hasDeliverableUpdateAccess(
        { ...consumer, consumer_tier: 3, subscription_status: 'trialing' },
        3,
      ),
    ).toBe(false)
  })

  test('app trial shape (tier 0, none) → false even though effective tier would be 3', () => {
    expect(
      hasDeliverableDownloadAccess(
        { role: 'consumer', consumer_tier: 0, subscription_status: 'none' },
        3,
      ),
    ).toBe(false)
    expect(
      hasDeliverableUpdateAccess(
        { role: 'consumer', consumer_tier: 0, subscription_status: 'none' },
        3,
      ),
    ).toBe(false)
  })

  test('tier 2 active → false for deliverable', () => {
    expect(
      hasDeliverableUpdateAccess(
        { ...consumer, consumer_tier: 2, subscription_status: 'active' },
        3,
      ),
    ).toBe(false)
  })

  test('one-time day 1 → update allowed', () => {
    const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
    const planExportPurchase = {
      editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    }
    expect(
      hasDeliverableUpdateAccess(consumer, 3, {
        planExportPurchase,
        now: new Date('2026-01-02T12:00:00.000Z'),
      }),
    ).toBe(true)
  })

  test('one-time day 89 → update allowed', () => {
    const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
    const planExportPurchase = {
      editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    }
    expect(
      hasDeliverableUpdateAccess(consumer, 3, {
        planExportPurchase,
        now: new Date('2026-03-30T12:00:00.000Z'),
      }),
    ).toBe(true)
  })

  test('one-time day 91 → update blocked', () => {
    const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
    const planExportPurchase = {
      editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    }
    expect(
      hasDeliverableUpdateAccess(consumer, 3, {
        planExportPurchase,
        now: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).toBe(false)
  })

  test('boundary at edit_window_ends_at → update blocked', () => {
    const editWindowEndsAt = '2026-04-01T12:00:00.000Z'
    expect(
      hasDeliverableUpdateAccess(
        consumer,
        3,
        {
          planExportPurchase: { editWindowEndsAt },
          now: new Date(editWindowEndsAt),
        },
      ),
    ).toBe(false)
  })
})

test.describe('hasDeliverableDownloadAccess', () => {
  test('one-time day 91 → download still allowed', () => {
    const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
    const planExportPurchase = {
      editWindowEndsAt: computePlanExportEditWindowEndsAt(purchasedAt).toISOString(),
    }
    expect(
      hasDeliverableDownloadAccess(consumer, 3, {
        planExportPurchase,
        now: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).toBe(true)
  })

  test('tier 1 no sub without purchase → false', () => {
    expect(hasDeliverableDownloadAccess(consumer, 3)).toBe(false)
  })

  test('one-time purchase does not unlock tier-1 prep sheet without active sub', () => {
    expect(
      hasDeliverableDownloadAccess(consumer, 1, {
        planExportPurchase: purchaseWindowFromDayOne(),
      }),
    ).toBe(false)
  })

  test('advisor bypasses gate', () => {
    expect(
      hasDeliverableDownloadAccess(
        { role: 'advisor', consumer_tier: 1, subscription_status: 'none' },
        3,
      ),
    ).toBe(true)
  })
})

test.describe('hasPaidDownloadAccess alias', () => {
  test('delegates to download access for completed purchase', () => {
    expect(
      hasPaidDownloadAccess(consumer, 3, {
        planExportPurchase: purchaseWindowFromDayOne(),
      }),
    ).toBe(true)
  })
})

test.describe('canExportRawData', () => {
  test('always true regardless of tier/status', () => {
    expect(canExportRawData()).toBe(true)
  })
})

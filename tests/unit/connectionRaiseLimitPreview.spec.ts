import { test, expect } from '@playwright/test'
import { buildConnectionRaiseLimitPreview } from '../../lib/billing/connectionRaiseLimitPreview'
import { buildAttorneyRaiseLimitPreview, buildAttorneyConnectionBillingSummary } from '../../lib/billing/attorneyConnectionBillingSummary'
import { buildRaiseLimitPreview } from '../../lib/billing/firmConnectionBillingSummary'
import { ATTORNEY_BANDS, ATTORNEY_FLOOR, ADVISOR_BANDS, ADVISOR_FLOOR } from '../../lib/pricing/connectionPricing'
import {
  attorneyBillableBeforeFloor,
  resolveAttorneyBillableQuantity,
} from '../../lib/billing/attorneyBillableQuantity'
import { resolveStickyBillableQuantity } from '../../lib/billing/firmConnectionStickyFloor'

test.describe('connectionRaiseLimitPreview', () => {
  test('attorney raise preview: next connect billable after 2 connected → 2', () => {
    const preview = buildAttorneyRaiseLimitPreview({
      connectedCount: 2,
      billingFloor: 1,
      newLimit: 3,
    })
    expect(preview.billableQuantity).toBe(1)
    expect(preview.nextBillableOnConnect).toBe(2)
    expect(preview.nextClientMonthlyCost).toBe(150)
    expect(preview.newMonthly).toBe(75)
  })

  test('advisor raise preview unchanged', () => {
    const preview = buildRaiseLimitPreview({
      connectedCount: 5,
      billingFloor: 5,
      newLimit: 8,
    })
    expect(preview.billableQuantity).toBe(5)
    expect(preview.nextBillableOnConnect).toBe(6)
  })

  test('ceiling limit 5 → 4 billable max for attorney bands', () => {
    const preview = buildConnectionRaiseLimitPreview({
      connectedCount: 0,
      billingFloor: 0,
      newLimit: 5,
      bands: ATTORNEY_BANDS,
      rateFloor: ATTORNEY_FLOOR,
      billableQuantity: resolveAttorneyBillableQuantity,
      bandCountForNewLimit: attorneyBillableBeforeFloor,
      billableAfterOneMoreConnect: (c) => attorneyBillableBeforeFloor(c + 1),
    })
    expect(attorneyBillableBeforeFloor(5)).toBe(4)
    expect(preview.newBandLabel).toBeTruthy()
  })
})

test.describe('attorney billing summary legibility', () => {
  test('at-capacity screen states free client plainly', () => {
    const summary = buildAttorneyConnectionBillingSummary({
      connectedCount: 2,
      clientLimit: 2,
      billingFloor: 1,
      resetCount: 0,
    })
    expect(summary.pageState).toBe('at_capacity')
    expect(summary.connectedCapacityLine).toContain('2 of 2')
    expect(summary.connectedCapacityLine).toContain('1 free')
    expect(summary.billingLine).toContain('Billing for 1 at $75/mo')
    expect(summary.atCapacityRaiseHint).toContain('$75/mo')
  })
})

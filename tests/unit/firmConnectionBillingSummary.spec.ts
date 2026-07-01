import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildFirmConnectionBillingSummary,
  buildRaiseLimitPreview,
  resolveConnectionBillingPageState,
} from '@/lib/billing/firmConnectionBillingSummary'
import { MAX_SELF_SERVE_RESETS } from '@/lib/billing/firmConnectionStickyFloor'

test.describe('buildFirmConnectionBillingSummary', () => {
  test('flag ON below capacity: 0 of 2, $120 rate, $240 est — not legacy $149/$298', () => {
    const summary = buildFirmConnectionBillingSummary({
      connectedCount: 0,
      clientLimit: 2,
      billingFloor: 2,
      resetCount: 0,
    })

    expect(summary.connectedCapacityLine).toBe('0 of 2 client capacity')
    expect(summary.ratePerClient).toBe(120)
    expect(summary.estimatedMonthly).toBe(240)
    expect(summary.pageState).toBe('floor_above_connected')
    expect(summary.planLine).toContain('Starter')
    expect(summary.ratePerClient).not.toBe(149)
    expect(summary.estimatedMonthly).not.toBe(298)
  })

  test('at capacity state when connected equals limit', () => {
    const summary = buildFirmConnectionBillingSummary({
      connectedCount: 2,
      clientLimit: 2,
      billingFloor: 2,
      resetCount: 0,
    })

    expect(summary.pageState).toBe('at_capacity')
    expect(summary.canRaiseLimit).toBe(true)
  })

  test('floor above connected explains sticky billing', () => {
    const summary = buildFirmConnectionBillingSummary({
      connectedCount: 0,
      clientLimit: 5,
      billingFloor: 3,
      resetCount: 0,
    })

    expect(summary.pageState).toBe('floor_above_connected')
    expect(summary.billableQuantity).toBe(3)
    expect(summary.estimatedMonthly).toBe(3 * 120)
  })

  test('can lower limit when under capacity and resets remain', () => {
    const summary = buildFirmConnectionBillingSummary({
      connectedCount: 1,
      clientLimit: 5,
      billingFloor: 3,
      resetCount: 0,
    })

    expect(summary.canLowerLimit).toBe(true)
    expect(summary.selfServeResetsRemaining).toBe(2)
  })

  test('cannot lower when resets exhausted', () => {
    const summary = buildFirmConnectionBillingSummary({
      connectedCount: 0,
      clientLimit: 5,
      billingFloor: 3,
      resetCount: MAX_SELF_SERVE_RESETS,
    })

    expect(summary.canLowerLimit).toBe(false)
    expect(summary.selfServeResetsRemaining).toBe(0)
  })
})

test.describe('buildRaiseLimitPreview', () => {
  test('shows band improvement when raising crosses threshold', () => {
    const preview = buildRaiseLimitPreview({
      connectedCount: 2,
      billingFloor: 2,
      newLimit: 11,
    })

    expect(preview.currentBandLabel).toBe('Starter')
    expect(preview.newBandLabel).toBe('Growth')
    expect(preview.newRatePerClient).toBe(102)
    expect(preview.rateImproved).toBe(true)
    expect(preview.newMonthly).toBe(2 * 102)
  })
})

test.describe('resolveConnectionBillingPageState', () => {
  test('prioritizes at_capacity over floor state', () => {
    expect(resolveConnectionBillingPageState(2, 2, 2)).toBe('at_capacity')
  })

  test('below capacity when headroom and floor not above connected', () => {
    expect(resolveConnectionBillingPageState(1, 5, 1)).toBe('below_capacity')
  })
})

test.describe('/billing page wiring', () => {
  test('flag ON uses FirmConnectionBillingClient; flag OFF keeps legacy FirmBillingClient', () => {
    const src = readFileSync(join(process.cwd(), 'app/billing/page.tsx'), 'utf8')
    expect(src).toContain('isConnectionBillingEnabled()')
    expect(src).toContain('FirmConnectionBillingClient')
    expect(src).toContain('FirmBillingClient')
    expect(src).toContain('loadFirmConnectionBillingProps')
    expect(src).toContain('buildFirmConnectionBillingSummary')
    expect(src).toMatch(/ADVISOR_FIRM_SEAT_RATES\[firmTierKey\]/)
  })

  test('member connection path is read-only', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/billing/page.tsx'), 'utf8')
    const clientSrc = readFileSync(
      join(process.cwd(), 'app/billing/_firm-connection-billing-client.tsx'),
      'utf8',
    )
    expect(pageSrc).toContain('isOwner={false}')
    expect(clientSrc).toContain('Your firm owner manages billing')
    expect(clientSrc).toContain('if (!isOwner)')
  })

  test('limit modal deep-links to raise form', () => {
    const src = readFileSync(join(process.cwd(), 'app/advisor/_advisor-client.tsx'), 'utf8')
    expect(src).toContain('/billing?action=raise')
  })
})

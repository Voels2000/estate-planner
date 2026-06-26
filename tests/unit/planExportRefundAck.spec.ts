/**
 * Plan & Export refund acknowledgment — gate, metadata bridge, fulfillment.
 * Run: npx playwright test tests/unit/planExportRefundAck.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  buildPlanExportRefundAckMetadata,
  parsePlanExportRefundAckFromMetadata,
  planExportRefundAckBlockReason,
} from '../../lib/billing/planExportRefundAck'
import { REFUND_POLICY_VERSION } from '../../lib/legal/plan-export-refund-policy'

test.describe('planExportRefundAckBlockReason', () => {
  test('blocks when ack not explicitly true', () => {
    for (const value of [undefined, null, false, 'true', 1, {}]) {
      const block = planExportRefundAckBlockReason(value)
      expect(block, String(value)).toMatchObject({
        code: 'refund_ack_required',
        httpStatus: 400,
      })
    }
  })

  test('allows only boolean true', () => {
    expect(planExportRefundAckBlockReason(true)).toBeNull()
  })
})

test.describe('buildPlanExportRefundAckMetadata', () => {
  test('stamps current policy version and server timestamp', () => {
    const meta = buildPlanExportRefundAckMetadata()
    expect(meta.refund_ack_version).toBe(REFUND_POLICY_VERSION)
    expect(meta.refund_ack_at).toBeTruthy()
    expect(Number.isNaN(Date.parse(meta.refund_ack_at))).toBe(false)
  })
})

test.describe('parsePlanExportRefundAckFromMetadata', () => {
  test('parses valid metadata', () => {
    const parsed = parsePlanExportRefundAckFromMetadata({
      refund_ack_version: REFUND_POLICY_VERSION,
      refund_ack_at: '2026-06-26T12:00:00.000Z',
    })
    expect(parsed).toEqual({
      version: REFUND_POLICY_VERSION,
      at: '2026-06-26T12:00:00.000Z',
    })
  })

  test('returns null when metadata incomplete', () => {
    expect(parsePlanExportRefundAckFromMetadata({})).toBeNull()
    expect(
      parsePlanExportRefundAckFromMetadata({ refund_ack_version: REFUND_POLICY_VERSION }),
    ).toBeNull()
    expect(
      parsePlanExportRefundAckFromMetadata({
        refund_ack_version: REFUND_POLICY_VERSION,
        refund_ack_at: 'not-a-date',
      }),
    ).toBeNull()
  })
})

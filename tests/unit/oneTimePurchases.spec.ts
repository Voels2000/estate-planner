/**
 * One-time purchase fulfillment + credit helpers.
 * Run: npx playwright test tests/unit/oneTimePurchases.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  applyPlanAndExportCreditIfEligible,
  fulfillPlanAndExportPurchase,
} from '../../lib/billing/oneTimePurchases'
import { PLAN_AND_EXPORT_SKU } from '../../lib/billing/stripePrices'
import { REFUND_POLICY_VERSION } from '../../lib/legal/plan-export-refund-policy'

const sampleRefundAck = {
  at: '2026-06-26T12:00:00.000Z',
  version: REFUND_POLICY_VERSION,
}

function mockAdmin(overrides: {
  purchase?: Record<string, unknown> | null
  consumeRow?: { id: string } | null
  insertError?: { code: string; message: string } | null
  insertedRow?: Record<string, unknown>
}) {
  let insertedPayload: Record<string, unknown> | null = null
  const selectResult = async () => ({
    data: overrides.purchase ?? null,
    error: null,
  })
  const chain = {
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: selectResult,
  }

  return {
    insertedPayload: () => insertedPayload,
    from: (table: string) => {
      if (table !== 'one_time_purchases') {
        throw new Error(`unexpected table ${table}`)
      }
      return {
        insert: async (payload: Record<string, unknown>) => {
          insertedPayload = payload
          return {
            error: overrides.insertError ?? null,
          }
        },
        select: () => chain,
        update: () => ({
          eq: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: overrides.consumeRow ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }
    },
  }
}

test.describe('fulfillPlanAndExportPurchase', () => {
  test('creates a purchase row on first delivery with refund ack', async () => {
    const admin = mockAdmin({})
    const result = await fulfillPlanAndExportPurchase({
      admin: admin as never,
      userId: 'user-1',
      sessionId: 'cs_test_1',
      paymentIntentId: 'pi_1',
      amountCents: 79000,
      currency: 'usd',
      refundAck: sampleRefundAck,
    })
    expect(result.created).toBe(true)
    expect(result.error).toBeNull()
    expect(admin.insertedPayload()).toMatchObject({
      refund_ack_at: sampleRefundAck.at,
      refund_ack_version: sampleRefundAck.version,
    })
  })

  test('fails closed without refund ack metadata', async () => {
    const admin = mockAdmin({})
    const result = await fulfillPlanAndExportPurchase({
      admin: admin as never,
      userId: 'user-1',
      sessionId: 'cs_test_missing_ack',
      paymentIntentId: 'pi_1',
      amountCents: 79000,
      currency: 'usd',
      refundAck: { at: '', version: '' },
    })
    expect(result.created).toBe(false)
    expect(result.error?.message).toMatch(/refund acknowledgment/i)
    expect(admin.insertedPayload()).toBeNull()
  })

  test('treats duplicate session id as no-op', async () => {
    const admin = mockAdmin({
      insertError: { code: '23505', message: 'duplicate key' },
    })
    const result = await fulfillPlanAndExportPurchase({
      admin: admin as never,
      userId: 'user-1',
      sessionId: 'cs_test_1',
      paymentIntentId: 'pi_1',
      amountCents: 79000,
      currency: 'usd',
      refundAck: sampleRefundAck,
    })
    expect(result.created).toBe(false)
    expect(result.error).toBeNull()
  })
})

test.describe('applyPlanAndExportCreditIfEligible', () => {
  test('applies credit once when purchase is unconsumed', async () => {
    const createBalanceTransaction = async () => ({ id: 'cbtxn_1' })
    const stripe = {
      customers: { createBalanceTransaction },
    }
    const admin = mockAdmin({
      purchase: {
        id: 'otp-1',
        amount_cents: 79000,
        currency: 'usd',
        credit_applied_at: null,
      },
      consumeRow: { id: 'otp-1' },
    })

    const result = await applyPlanAndExportCreditIfEligible({
      admin: admin as never,
      stripe: stripe as never,
      userId: 'user-1',
      stripeCustomerId: 'cus_1',
    })

    expect(result.applied).toBe(true)
  })

  test('skips when no eligible purchase', async () => {
    const admin = mockAdmin({ purchase: null })
    const stripe = { customers: { createBalanceTransaction: async () => ({}) } }
    const result = await applyPlanAndExportCreditIfEligible({
      admin: admin as never,
      stripe: stripe as never,
      userId: 'user-1',
      stripeCustomerId: 'cus_1',
    })
    expect(result.applied).toBe(false)
  })
})

test('PLAN_AND_EXPORT_SKU stable string', () => {
  expect(PLAN_AND_EXPORT_SKU).toBe('plan_and_export')
})

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

function mockAdmin(overrides: {
  purchase?: Record<string, unknown> | null
  consumeRow?: { id: string } | null
  insertError?: { code: string; message: string } | null
}) {
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
    from: (table: string) => {
      if (table !== 'one_time_purchases') {
        throw new Error(`unexpected table ${table}`)
      }
      return {
        insert: async () => ({
          error: overrides.insertError ?? null,
        }),
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
  test('creates a purchase row on first delivery', async () => {
    const admin = mockAdmin({})
    const result = await fulfillPlanAndExportPurchase({
      admin: admin as never,
      userId: 'user-1',
      sessionId: 'cs_test_1',
      paymentIntentId: 'pi_1',
      amountCents: 149000,
      currency: 'usd',
    })
    expect(result.created).toBe(true)
    expect(result.error).toBeNull()
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
      amountCents: 149000,
      currency: 'usd',
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
        amount_cents: 149000,
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

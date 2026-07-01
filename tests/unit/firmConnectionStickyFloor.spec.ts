import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MAX_SELF_SERVE_RESETS,
  applyFirmConnectionLimitReset,
  buildRebandPreview,
  computeRatchetedBillingFloor,
  connectionLimitSeedFromCheckoutQuantity,
  ratchetFirmBillingFloorUp,
  resolveFirmStickyFloorBillableQuantity,
  resolveStickyBillableQuantity,
  validateRaiseClientLimit,
  validateSelfServeReset,
  wouldExceedClientLimit,
} from '@/lib/billing/firmConnectionStickyFloor'
import {
  buildFirmCheckoutCompletedUpdate,
  buildFirmSubscriptionUpdatedUpdate,
} from '@/lib/billing/firmCheckoutWebhook'
import { isAdvisorConnectionCheckoutPrice } from '@/lib/billing/resolveAdvisorFirmCheckout'

type FirmStickyState = {
  billing_floor: number
  client_limit: number
  reset_count: number
}

function mockStickyFloorAdmin(
  firmId: string,
  state: FirmStickyState,
  connectedClientIds: string[],
): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'firms') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => {
              if (id !== firmId) {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                  single: async () => ({ data: null, error: { message: 'not found' } }),
                }
              }
              return {
                maybeSingle: async () => ({
                  data: { billing_floor: state.billing_floor },
                  error: null,
                }),
                single: async () => ({
                  data: {
                    client_limit: state.client_limit,
                    reset_count: state.reset_count,
                    billing_floor: state.billing_floor,
                  },
                  error: null,
                }),
              }
            },
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              if (id !== firmId) return { error: null }
              if (typeof payload.billing_floor === 'number') {
                state.billing_floor = payload.billing_floor
              }
              if (typeof payload.client_limit === 'number') {
                state.client_limit = payload.client_limit
              }
              if (typeof payload.reset_count === 'number') {
                state.reset_count = payload.reset_count
              }
              return { error: null }
            },
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ id: 'adv-1' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'advisor_clients') {
        return {
          select: () => ({
            in: () => ({
              in: async () => ({
                data: connectedClientIds.map((client_id) => ({ client_id })),
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

test.describe('firmConnectionStickyFloor pure helpers', () => {
  test('track up to limit — billable follows connected while below prepaid ceiling', () => {
    expect(resolveStickyBillableQuantity(1, 0)).toBe(1)
    expect(resolveStickyBillableQuantity(2, 1)).toBe(2)
    expect(resolveStickyBillableQuantity(3, 3)).toBe(3)
    expect(computeRatchetedBillingFloor(0, 3)).toBe(3)
  })

  test('pin on disconnect — floor sticky above connected', () => {
    expect(resolveStickyBillableQuantity(2, 3)).toBe(3)
    expect(computeRatchetedBillingFloor(3, 2)).toBe(3)
  })

  test('wouldExceedClientLimit at ceiling', () => {
    expect(wouldExceedClientLimit(5, 5, true)).toBe(true)
    expect(wouldExceedClientLimit(4, 5, true)).toBe(false)
    expect(wouldExceedClientLimit(5, 5, false)).toBe(false)
  })

  test('checkout seed sets both limit and floor', () => {
    expect(connectionLimitSeedFromCheckoutQuantity(5)).toEqual({
      client_limit: 5,
      billing_floor: 5,
    })
  })

  test('reset reband preview shows rate increase when lowering band', () => {
    const preview = buildRebandPreview({
      currentLimit: 55,
      newLimit: 40,
      connectedCount: 40,
      resetCount: 0,
    })
    expect(preview.oldBandLabel).toBe('Practice')
    expect(preview.newBandLabel).toBe('Growth')
    expect(preview.oldRatePerClient).toBe(84)
    expect(preview.newRatePerClient).toBe(102)
    expect(preview.newMonthlyEstimate).toBe(102 * 40)
  })
})

test.describe('B2 adversarial — sync never lowers billing_floor', () => {
  const firmId = 'firm-sticky'

  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
    delete process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY
  })

  test.beforeEach(() => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = 'price_conn_test'
  })

  test('path 1: disconnect repeatedly — floor holds', async () => {
    const state: FirmStickyState = { billing_floor: 3, client_limit: 5, reset_count: 0 }
    const admin = mockStickyFloorAdmin(firmId, state, ['c1', 'c2'])

    await ratchetFirmBillingFloorUp(admin, firmId, 2)
    expect(state.billing_floor).toBe(3)

    const billable = await resolveFirmStickyFloorBillableQuantity(admin, firmId)
    expect(billable).toBe(3)
    expect(state.billing_floor).toBe(3)
  })

  test('path 2: subscription.updated builder never includes billing_floor or client_limit', () => {
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = 'price_conn_test'
    const update = buildFirmSubscriptionUpdatedUpdate({
      mappedStatus: 'active',
      stripeQuantity: 1,
      stripePriceId: 'price_conn_test',
    })
    expect(update).not.toHaveProperty('billing_floor')
    expect(update).not.toHaveProperty('client_limit')
    expect(update).not.toHaveProperty('seat_count')
  })

  test('path 3: direct sync with lower connected count does not ratchet floor down', async () => {
    const state: FirmStickyState = { billing_floor: 5, client_limit: 5, reset_count: 0 }
    const admin = mockStickyFloorAdmin(firmId, state, ['c1'])

    const billable = await resolveFirmStickyFloorBillableQuantity(admin, firmId)
    expect(billable).toBe(5)
    expect(state.billing_floor).toBe(5)
  })

  test('path 4: ratchet only increases floor when connected exceeds prior', async () => {
    const state: FirmStickyState = { billing_floor: 2, client_limit: 5, reset_count: 0 }
    const admin = mockStickyFloorAdmin(firmId, state, ['a', 'b', 'c'])

    await ratchetFirmBillingFloorUp(admin, firmId, 3)
    expect(state.billing_floor).toBe(3)

    await ratchetFirmBillingFloorUp(admin, firmId, 1)
    expect(state.billing_floor).toBe(3)
  })

  test('path 5: only explicit reset lowers billing_floor', async () => {
    const state: FirmStickyState = { billing_floor: 55, client_limit: 55, reset_count: 0 }
    const admin = mockStickyFloorAdmin(firmId, state, Array.from({ length: 40 }, (_, i) => `c${i}`))

    await applyFirmConnectionLimitReset(admin, firmId, 40)
    expect(state.billing_floor).toBe(40)
    expect(state.client_limit).toBe(40)
    expect(state.reset_count).toBe(1)
  })

  test('webhook checkout seeds floor; subscription.updated does not re-seed', () => {
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = 'price_conn_test'
    const checkout = buildFirmCheckoutCompletedUpdate({
      subscriptionId: 'sub_1',
      stripeQuantity: 5,
      priceId: 'price_conn_test',
    })
    expect(checkout.client_limit).toBe(5)
    expect(checkout.billing_floor).toBe(5)

    const updated = buildFirmSubscriptionUpdatedUpdate({
      mappedStatus: 'active',
      stripeQuantity: 1,
      stripePriceId: 'price_conn_test',
    })
    expect(updated.billing_floor).toBeUndefined()
    expect(updated.client_limit).toBeUndefined()
  })

  test('static: webhook route uses create-time seed helper only on checkout.session.completed', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/stripe/webhook/route.ts'),
      'utf8',
    )
    expect(src).toContain('buildFirmCheckoutCompletedUpdate')
    expect(src).toContain('buildFirmSubscriptionUpdatedUpdate')
    const checkoutIdx = src.indexOf("case 'checkout.session.completed'")
    const updatedIdx = src.indexOf("case 'customer.subscription.updated'")
    const seedIdx = src.indexOf('buildFirmCheckoutCompletedUpdate', checkoutIdx)
    expect(checkoutIdx).toBeGreaterThan(-1)
    expect(seedIdx).toBeGreaterThan(checkoutIdx)
    expect(seedIdx).toBeLessThan(updatedIdx)
    expect(src.indexOf('billing_floor', updatedIdx)).toBe(-1)
  })
})

test.describe('reset and raise guards', () => {
  test('reset guard: below connected usage rejected', () => {
    const result = validateSelfServeReset({
      newLimit: 30,
      connectedCount: 40,
      resetCount: 0,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('below_connected')
  })

  test('reset frequency: third blocked', () => {
    const result = validateSelfServeReset({
      newLimit: 40,
      connectedCount: 30,
      resetCount: MAX_SELF_SERVE_RESETS,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('reset_frequency_exceeded')
  })

  test('raise must exceed current limit', () => {
    expect(validateRaiseClientLimit({ currentLimit: 5, newLimit: 5 }).ok).toBe(false)
    expect(validateRaiseClientLimit({ currentLimit: 5, newLimit: 10 }).ok).toBe(true)
  })
})

test.describe('flag off inert', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
    delete process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY
  })

  test('checkout seed skipped when flag off', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = 'price_conn_test'
    const update = buildFirmCheckoutCompletedUpdate({
      subscriptionId: 'sub_1',
      stripeQuantity: 5,
      priceId: 'price_conn_test',
    })
    expect(update.client_limit).toBeUndefined()
    expect(update.billing_floor).toBeUndefined()
  })

  test('legacy subscription.updated still mirrors seat_count', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const update = buildFirmSubscriptionUpdatedUpdate({
      mappedStatus: 'active',
      stripeQuantity: 7,
      stripePriceId: 'price_legacy',
    })
    expect(update.seat_count).toBe(7)
  })
})

test.describe('connection price helper', () => {
  test.afterEach(() => {
    delete process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY
  })

  test('isAdvisorConnectionCheckoutPrice matches env', () => {
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = 'price_conn_test'
    expect(isAdvisorConnectionCheckoutPrice('price_conn_test')).toBe(true)
    expect(isAdvisorConnectionCheckoutPrice('price_other')).toBe(false)
  })
})

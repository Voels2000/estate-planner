import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeAttorneyBackfillClientLimit,
  ratchetAttorneyBillingFloorUp,
  resolveAttorneyStickyFloorBillableQuantity,
} from '@/lib/billing/attorneyConnectionStickyFloor'
import {
  buildAttorneyListingCheckoutCompletedUpdate,
  buildAttorneySubscriptionUpdatedProfileUpdate,
} from '@/lib/billing/attorneyCheckoutWebhook'
import { isAttorneyConnectionCheckoutPrice } from '@/lib/billing/resolveAttorneyCheckout'
import { computeRatchetedBillingFloor } from '@/lib/billing/firmConnectionStickyFloor'

type ListingStickyState = {
  profile_id: string | null
  billing_floor: number
  client_limit: number
  reset_count: number
  subscription_status: string | null
}

function mockAttorneyStickyAdmin(
  listingId: string,
  state: ListingStickyState,
  connectedHouseholdIds: string[],
): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'attorney_listings') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => {
              if (id !== listingId) {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                  single: async () => ({ data: null, error: { message: 'not found' } }),
                }
              }
              return {
                maybeSingle: async () => ({
                  data: {
                    profile_id: state.profile_id,
                    billing_floor: state.billing_floor,
                    client_limit: state.client_limit,
                    reset_count: state.reset_count,
                  },
                  error: null,
                }),
                single: async () => ({
                  data: {
                    profile_id: state.profile_id,
                    billing_floor: state.billing_floor,
                    client_limit: state.client_limit,
                    reset_count: state.reset_count,
                  },
                  error: null,
                }),
              }
            },
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              if (id !== listingId) return { error: null }
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
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  subscription_status: state.subscription_status,
                  stripe_subscription_id: state.subscription_status ? 'sub_test' : null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'attorney_clients') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: connectedHouseholdIds.map((client_id) => ({ client_id })),
                error: null,
              }),
            }),
            in: () => ({
              eq: () => ({
                in: async () => ({ data: [], error: null }),
              }),
              in: async () => ({
                data: connectedHouseholdIds.map((client_id) => ({ client_id })),
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

test.describe('attorney backfill client_limit', () => {
  test('free tier with zero connections → client_limit 1', () => {
    expect(
      computeAttorneyBackfillClientLimit({
        connectedCount: 0,
        attorneyTier: 0,
        subscriptionStatus: null,
      }),
    ).toBe(1)
  })

  test('free tier does not inherit legacy tier-0 cap of 3', () => {
    expect(
      computeAttorneyBackfillClientLimit({
        connectedCount: 0,
        attorneyTier: 0,
        subscriptionStatus: 'active',
      }),
    ).toBe(1)
  })

  test('paid legacy starter preserves headroom above connected', () => {
    expect(
      computeAttorneyBackfillClientLimit({
        connectedCount: 12,
        attorneyTier: 1,
        subscriptionStatus: 'active',
      }),
    ).toBe(15)
  })

  test('unpaid legacy tier does not apply tier cap', () => {
    expect(
      computeAttorneyBackfillClientLimit({
        connectedCount: 2,
        attorneyTier: 1,
        subscriptionStatus: 'canceled',
      }),
    ).toBe(2)
  })
})

test.describe('attorney ratchet-gate — pre-subscription floor invariant', () => {
  const listingId = 'listing-free'

  test('pure ratchet math would raise 0→1 but gate blocks without subscription', () => {
    expect(computeRatchetedBillingFloor(0, 1)).toBe(1)
  })

  test('connect free client — floor stays 0 without subscription', async () => {
    const state: ListingStickyState = {
      profile_id: 'profile-1',
      billing_floor: 0,
      client_limit: 1,
      reset_count: 0,
      subscription_status: null,
    }
    const admin = mockAttorneyStickyAdmin(listingId, state, ['hh-1'])

    const floor = await ratchetAttorneyBillingFloorUp(admin, listingId, 1)
    expect(floor).toBe(0)
    expect(state.billing_floor).toBe(0)
  })

  test('disconnect and reconnect pre-subscription — floor never moves', async () => {
    const state: ListingStickyState = {
      profile_id: 'profile-1',
      billing_floor: 0,
      client_limit: 1,
      reset_count: 0,
      subscription_status: null,
    }
    const admin = mockAttorneyStickyAdmin(listingId, state, [])

    await ratchetAttorneyBillingFloorUp(admin, listingId, 0)
    expect(state.billing_floor).toBe(0)

    await ratchetAttorneyBillingFloorUp(admin, listingId, 1)
    expect(state.billing_floor).toBe(0)

    const billable = await resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
    expect(billable).toBe(0)
    expect(state.billing_floor).toBe(0)
  })

  test('sync path with no subscription returns billable 0 and does not ratchet', async () => {
    const state: ListingStickyState = {
      profile_id: 'profile-1',
      billing_floor: 0,
      client_limit: 1,
      reset_count: 0,
      subscription_status: null,
    }
    const admin = mockAttorneyStickyAdmin(listingId, state, ['hh-1'])

    const billable = await resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
    expect(billable).toBe(0)
    expect(state.billing_floor).toBe(0)
  })

  test('after paid subscription ratchet applies normally', async () => {
    const state: ListingStickyState = {
      profile_id: 'profile-1',
      billing_floor: 2,
      client_limit: 2,
      reset_count: 0,
      subscription_status: 'active',
    }
    const admin = mockAttorneyStickyAdmin(listingId, state, ['hh-1', 'hh-2', 'hh-3'])

    await ratchetAttorneyBillingFloorUp(admin, listingId, 3)
    expect(state.billing_floor).toBe(3)

    const billable = await resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
    expect(billable).toBe(3)
  })

  test('post-subscription disconnect — floor pins, sync does not lower', async () => {
    const state: ListingStickyState = {
      profile_id: 'profile-1',
      billing_floor: 3,
      client_limit: 5,
      reset_count: 0,
      subscription_status: 'active',
    }
    const admin = mockAttorneyStickyAdmin(listingId, state, ['hh-1'])

    const billable = await resolveAttorneyStickyFloorBillableQuantity(admin, listingId)
    expect(billable).toBe(3)
    expect(state.billing_floor).toBe(3)
  })
})

test.describe('attorney checkout webhook invariants', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
    delete process.env.STRIPE_PRICE_ATTORNEY_CONNECTION_MONTHLY
  })

  test('checkout seeds listing floor; subscription.updated profile update never touches floor', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    process.env.STRIPE_PRICE_ATTORNEY_CONNECTION_MONTHLY = 'price_att_conn'

    const listingUpdate = buildAttorneyListingCheckoutCompletedUpdate({
      stripeQuantity: 2,
      priceId: 'price_att_conn',
    })
    expect(listingUpdate).toEqual({ client_limit: 2, billing_floor: 2 })

    const profileUpdate = buildAttorneySubscriptionUpdatedProfileUpdate({
      mappedStatus: 'active',
      priceId: 'price_att_conn',
    })
    expect(profileUpdate).not.toHaveProperty('billing_floor')
    expect(profileUpdate).not.toHaveProperty('client_limit')
  })

  test('isAttorneyConnectionCheckoutPrice matches env', () => {
    process.env.STRIPE_PRICE_ATTORNEY_CONNECTION_MONTHLY = 'price_att_conn'
    expect(isAttorneyConnectionCheckoutPrice('price_att_conn')).toBe(true)
    expect(isAttorneyConnectionCheckoutPrice('price_other')).toBe(false)
  })

  test('static: ratchetAttorneyBillingFloorUp gates on subscription before update', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/billing/attorneyConnectionStickyFloor.ts'),
      'utf8',
    )
    expect(src).toContain('hasActiveAttorneyBillingSubscription')
    expect(src).toMatch(
      /if\s*\(\s*!hasActiveAttorneyBillingSubscription[\s\S]*return priorFloor/,
    )
  })
})

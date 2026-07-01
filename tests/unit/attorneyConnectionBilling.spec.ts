import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessAttorneyConnectionBillingGate,
  evaluateAttorneyConnectionBillingGate,
} from '@/lib/billing/attorneyConnectionBilling'

type MockConfig = {
  listingId: string
  profileId: string | null
  subscriptionStatus: string | null
  clientLimit: number | null
  connectedHouseholdIds: string[]
}

function mockAdmin(config: MockConfig): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'attorney_listings') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () =>
                id === config.listingId
                  ? {
                      data: {
                        profile_id: config.profileId,
                        client_limit: config.clientLimit,
                        billing_floor: 0,
                        reset_count: 0,
                      },
                      error: null,
                    }
                  : { data: null, error: null },
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  subscription_status: config.subscriptionStatus,
                  stripe_subscription_id: config.subscriptionStatus ? 'sub_1' : null,
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
            eq: (_col: string, listingId: string) => {
              if (listingId !== config.listingId) {
                return {
                  in: async () => ({ data: [], error: null }),
                }
              }
              return {
                eq: (_c: string, householdId: string) => ({
                  in: async () => ({
                    data: config.connectedHouseholdIds.includes(householdId)
                      ? [{ client_id: householdId }]
                      : [],
                    error: null,
                  }),
                }),
                in: async () => ({
                  data: config.connectedHouseholdIds.map((client_id) => ({ client_id })),
                  error: null,
                }),
              }
            },
            in: () => ({
              eq: () => ({
                in: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

test.describe('attorneyConnectionBilling gate', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('first connect free — no checkout required at limit 1', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockAdmin({
      listingId: 'listing-1',
      profileId: 'profile-1',
      subscriptionStatus: null,
      clientLimit: 1,
      connectedHouseholdIds: [],
    })
    const result = await evaluateAttorneyConnectionBillingGate(admin, 'listing-1', 'hh-1')
    expect(result).toEqual({ ok: true })
  })

  test('second connect without subscription → attorney_checkout_required qty 1 (billable)', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockAdmin({
      listingId: 'listing-1',
      profileId: 'profile-1',
      subscriptionStatus: null,
      clientLimit: 1,
      connectedHouseholdIds: ['hh-1'],
    })
    const result = await evaluateAttorneyConnectionBillingGate(admin, 'listing-1', 'hh-2')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failure).toEqual({ kind: 'attorney_checkout_required', quantity: 1 })
  })

  test('unclaimed listing → listing_unclaimed', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockAdmin({
      listingId: 'listing-1',
      profileId: null,
      subscriptionStatus: null,
      clientLimit: 1,
      connectedHouseholdIds: [],
    })
    const result = await assessAttorneyConnectionBillingGate(admin, 'listing-1', 'hh-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
  })

  test('flag off is inert', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const admin = mockAdmin({
      listingId: 'listing-1',
      profileId: 'profile-1',
      subscriptionStatus: null,
      clientLimit: 1,
      connectedHouseholdIds: ['hh-1'],
    })
    const result = await assessAttorneyConnectionBillingGate(admin, 'listing-1', 'hh-2')
    expect(result).toEqual({ ok: true })
  })
})

import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveFirmStripeBillableQuantity } from '@/lib/stripe/syncFirmQuantity'

/** Minimal mock matching firmConnectedHouseholds query shape. */
function mockFirmConnectedHouseholdsAdmin(clientIds: string[]): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ id: 'advisor-1' }],
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
                data: clientIds.map((client_id) => ({ client_id })),
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

test.describe('connectionBillingFlag', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('defaults off', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(isConnectionBillingEnabled()).toBe(false)
  })

  test('enabled only when explicitly true', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    expect(isConnectionBillingEnabled()).toBe(true)
    process.env.CONNECTION_BILLING_ENABLED = '1'
    expect(isConnectionBillingEnabled()).toBe(false)
  })
})

test.describe('resolveFirmStripeBillableQuantity', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('flag off uses seat_count unchanged (legacy per-seat metering)', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const admin = {} as SupabaseClient
    expect(await resolveFirmStripeBillableQuantity(admin, 'firm-1', 7)).toBe(7)
    expect(await resolveFirmStripeBillableQuantity(admin, 'firm-1', null)).toBe(1)
    expect(await resolveFirmStripeBillableQuantity(admin, 'firm-1', undefined)).toBe(1)
  })

  test('flag on ignores seat_count and uses connected household count', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockFirmConnectedHouseholdsAdmin(['client-a', 'client-b'])
    expect(await resolveFirmStripeBillableQuantity(admin, 'firm-a', 99)).toBe(2)
  })
})

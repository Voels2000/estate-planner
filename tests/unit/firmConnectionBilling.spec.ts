import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessFirmConnectionBillingGate,
  hasActiveFirmBillingSubscription,
  shouldSyncFirmStripeOnRosterChange,
  syncFirmConnectionBillingQuantity,
  wouldConnectAddBillableHousehold,
} from '@/lib/billing/firmConnectionBilling'

type MockConfig = {
  firmId: string | null
  subscriptionStatus: string | null
  advisorIds: string[]
  connectedClientIds: string[]
}

function mockAdmin(config: MockConfig): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: (columns: string) => ({
            eq: (column: string, value: string) => {
              if (columns === 'firm_id' && column === 'id') {
                return {
                  maybeSingle: async () => ({
                    data: config.firmId ? { firm_id: config.firmId } : { firm_id: null },
                    error: null,
                  }),
                }
              }
              if (columns === 'id' && column === 'firm_id') {
                return Promise.resolve({
                  data: config.advisorIds.map((id) => ({ id })),
                  error: null,
                })
              }
              throw new Error(`profiles.select(${columns}).eq(${column})`)
            },
          }),
        }
      }
      if (table === 'firms') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { subscription_status: config.subscriptionStatus },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'advisor_clients') {
        return {
          select: () => ({
            in: (column: string, values: string[]) => {
              if (column === 'advisor_id') {
                return {
                  eq: (_c: string, clientUserId: string) => ({
                    in: async () => ({
                      data: config.connectedClientIds.includes(clientUserId)
                        ? [{ client_id: clientUserId }]
                        : [],
                      error: null,
                    }),
                  }),
                  in: async (_statusCol: string, _statuses: string[]) => ({
                    data: config.connectedClientIds.map((client_id) => ({ client_id })),
                    error: null,
                  }),
                }
              }
              throw new Error(`advisor_clients.in(${column})`)
            },
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

test.describe('firmConnectionBilling', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('hasActiveFirmBillingSubscription accepts active and trialing', () => {
    expect(hasActiveFirmBillingSubscription('active')).toBe(true)
    expect(hasActiveFirmBillingSubscription('trialing')).toBe(true)
    expect(hasActiveFirmBillingSubscription(null)).toBe(false)
    expect(hasActiveFirmBillingSubscription('canceled')).toBe(false)
  })

  test('shouldSyncFirmStripeOnRosterChange is inverse of connection flag', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(shouldSyncFirmStripeOnRosterChange()).toBe(true)
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    expect(shouldSyncFirmStripeOnRosterChange()).toBe(false)
  })

  test('wouldConnectAddBillableHousehold is false when client already connected in firm', async () => {
    const admin = mockAdmin({
      firmId: 'firm-1',
      subscriptionStatus: null,
      connectedClientIds: ['client-a'],
      advisorIds: ['adv-1'],
    })
    expect(await wouldConnectAddBillableHousehold(admin, 'firm-1', 'client-a')).toBe(false)
    expect(await wouldConnectAddBillableHousehold(admin, 'firm-1', 'client-b')).toBe(true)
  })

  test('assessFirmConnectionBillingGate returns 402 when unpaid firm would add first household', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockAdmin({
      firmId: 'firm-1',
      subscriptionStatus: null,
      connectedClientIds: [],
      advisorIds: ['adv-1'],
    })
    const result = await assessFirmConnectionBillingGate(admin, 'adv-1', 'client-new')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(402)
    const body = await result.response.json()
    expect(body).toEqual({ error: 'firm_checkout_required', quantity: 1 })
  })

  test('assessFirmConnectionBillingGate allows connect when firm sub is active', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockAdmin({
      firmId: 'firm-1',
      subscriptionStatus: 'active',
      connectedClientIds: [],
      advisorIds: ['adv-1'],
    })
    const result = await assessFirmConnectionBillingGate(admin, 'adv-1', 'client-new')
    expect(result).toEqual({ ok: true })
  })

  test('assessFirmConnectionBillingGate is inert when flag off', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const admin = mockAdmin({
      firmId: 'firm-1',
      subscriptionStatus: null,
      connectedClientIds: [],
      advisorIds: ['adv-1'],
    })
    const result = await assessFirmConnectionBillingGate(admin, 'adv-1', 'client-new')
    expect(result).toEqual({ ok: true })
  })
})

test.describe('Phase 4b flag-off contract', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('roster paths keep Stripe sync when flag off', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(shouldSyncFirmStripeOnRosterChange()).toBe(true)
  })

  test('connect/disconnect sync wrapper is inert when flag off', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    await expect(syncFirmConnectionBillingQuantity('firm-1')).resolves.toBeUndefined()
  })

  test('accept-request preserves legacy tier_limit path when flag off', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/advisor/accept-request/route.ts'),
      'utf8',
    )
    expect(src).toContain('isConnectionBillingEnabled()')
    expect(src).toContain('getAdvisorClientCapacity')
    expect(src).toContain("error: 'tier_limit_reached'")
    expect(src).not.toMatch(/if\s*\(\s*!isConnectionBillingEnabled\(\)\s*\)\s*\{[\s\S]*getAdvisorClientCapacity/)
  })

  test('accept-request consumer handoff runs only after gate pass and connect update', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/advisor/accept-request/route.ts'),
      'utf8',
    )
    const gateIdx = src.indexOf('assessFirmConnectionBillingGate')
    const updateIdx = src.indexOf("status: 'active'")
    const afterIdx = src.indexOf('after(()')
    const handoffIdx = src.indexOf('await applyAdvisorConnectionBilling')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(updateIdx)
    expect(updateIdx).toBeLessThan(afterIdx)
    expect(handoffIdx).toBeGreaterThan(afterIdx)
    expect(src.indexOf('if (!gate.ok) return gate.response')).toBeGreaterThan(-1)
  })

  test('firm invite relaxes billing sub and purchased-seat gates only when flag on', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/firm/invite/route.ts'), 'utf8')
    expect(src).toContain('!isConnectionBillingEnabled()')
    expect(src).toMatch(
      /!isConnectionBillingEnabled\(\)[\s\S]*subscription_status/,
    )
    expect(src).toMatch(
      /!isConnectionBillingEnabled\(\)[\s\S]*purchasedSeats/,
    )
  })

  test('roster join/remove guard sync behind shouldSyncFirmStripeOnRosterChange', () => {
    for (const rel of [
      'app/api/firm/join/route.ts',
      'app/api/firm/remove-member/route.ts',
      'lib/auth/completeSignup.ts',
    ]) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src, rel).toContain('shouldSyncFirmStripeOnRosterChange()')
    }
  })
})

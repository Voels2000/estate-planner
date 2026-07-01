import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { resolveFirmStripeBillableQuantity } from '@/lib/stripe/syncFirmQuantity'

/** Legacy pre-4a: `const seatCount = firm?.seat_count ?? 1` */
function legacySeatCount(seatCount: number | null | undefined): number {
  return seatCount ?? 1
}

function adminThatMustNotBeQueried(): SupabaseClient {
  return {
    from: () => {
      throw new Error('flag-off must not query Supabase')
    },
  } as unknown as SupabaseClient
}

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

  test('flag off matches legacy seat_count ?? 1 for roster-sized firms', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const admin = adminThatMustNotBeQueried()
    const cases = [1, 2, 7, 10, 50, 250, 0] as const
    for (const seatCount of cases) {
      const resolved = await resolveFirmStripeBillableQuantity(admin, 'firm-x', seatCount)
      expect(resolved, `seat_count=${seatCount}`).toBe(legacySeatCount(seatCount))
    }
    for (const seatCount of [null, undefined] as const) {
      const resolved = await resolveFirmStripeBillableQuantity(admin, 'firm-x', seatCount)
      expect(resolved, `seat_count=${String(seatCount)}`).toBe(legacySeatCount(seatCount))
    }
  })

  test('flag off never queries connected households (inert refactor)', async () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    await expect(
      resolveFirmStripeBillableQuantity(adminThatMustNotBeQueried(), 'firm-1', 5),
    ).resolves.toBe(5)
  })

  test('flag on ignores seat_count and uses connected household count', async () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const admin = mockFirmConnectedHouseholdsAdmin(['client-a', 'client-b'])
    expect(await resolveFirmStripeBillableQuantity(admin, 'firm-a', 99)).toBe(2)
  })
})

/** Phase 4a: sync must stay on roster events only until 4b decouples client connect/disconnect. */
test.describe('syncFirmStripeQuantity call sites (Phase 4a contract)', () => {
  const ALLOWED_CALLERS = [
    'app/api/firm/join/route.ts',
    'app/api/firm/remove-member/route.ts',
    'lib/auth/completeSignup.ts',
    'lib/billing/firmConnectionBilling.ts',
  ] as const

  const CONNECT_DISCONNECT_ROUTES = [
    'app/api/advisor/accept-request/route.ts',
    'app/api/invite/accept/route.ts',
    'app/api/advisor/link-pending/route.ts',
    'app/api/advisor/remove-client/route.ts',
    'app/api/consumer/disconnect-advisor/route.ts',
  ] as const

  test('syncFirmStripeQuantity is only invoked from roster paths and connection billing wrapper', () => {
    const callers: string[] = []
    walkTs(join(process.cwd(), 'app'), (file) => {
      const rel = file.replace(process.cwd() + '/', '')
      if (rel === 'lib/stripe/syncFirmQuantity.ts') return
      const src = readFileSync(file, 'utf8')
      if (src.includes('syncFirmStripeQuantity(')) callers.push(rel)
    })
    walkTs(join(process.cwd(), 'lib'), (file) => {
      const rel = file.replace(process.cwd() + '/', '')
      if (rel === 'lib/stripe/syncFirmQuantity.ts') return
      const src = readFileSync(file, 'utf8')
      if (src.includes('syncFirmStripeQuantity(')) callers.push(rel)
    })

    expect([...callers].sort()).toEqual([...ALLOWED_CALLERS].sort())
  })

  test('connect/disconnect routes use syncFirmConnectionBillingQuantity wrapper, not direct sync', () => {
    const missingWrapper: string[] = []
    const directSync: string[] = []
    for (const rel of CONNECT_DISCONNECT_ROUTES) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      if (!src.includes('syncFirmConnectionBillingQuantity')) missingWrapper.push(rel)
      if (src.includes('syncFirmStripeQuantity')) directSync.push(rel)
    }
    expect(missingWrapper, `missing wrapper: ${missingWrapper.join(', ')}`).toEqual([])
    expect(directSync, `direct sync in connect/disconnect: ${directSync.join(', ')}`).toEqual([])
  })
})

function walkTs(dir: string, visit: (file: string) => void): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walkTs(path, visit)
    } else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      visit(path)
    }
  }
}

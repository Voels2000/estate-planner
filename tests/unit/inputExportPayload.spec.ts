/**
 * PR 6 — input export uses EXPORT_INPUT_TABLES from inputComputedBoundary.
 * Run: npm run test:unit -- tests/unit/inputExportPayload.spec.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import {
  EXPORT_COMPUTED_DENYLIST,
  EXPORT_INPUT_TABLES,
} from '@/lib/access/inputComputedBoundary'
import {
  INPUT_EXPORT_SCHEMA_VERSION,
  loadInputExportPayload,
} from '@/lib/export/loadInputExportPayload'

function mockSupabase(rowsByTable: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({
          data: rowsByTable[table] ?? [],
          error: null,
        }),
      }),
    }),
  }
}

test.describe('loadInputExportPayload', () => {
  test('serializes only EXPORT_INPUT_TABLES — computed tables structurally absent', async () => {
    const userId = 'user-1'
    const household = { id: 'hh-1', owner_id: userId, name: 'Test' }
    const rowsByTable: Record<string, unknown[]> = {
      households: [household],
      assets: [{ id: 'a1', owner_id: userId, name: 'Brokerage', value: 100 }],
      liabilities: [],
      income: [],
      expenses: [],
      insurance_policies: [],
      real_estate: [],
      businesses: [],
    }

    const payload = await loadInputExportPayload(mockSupabase(rowsByTable) as never, userId)

    expect(payload.schema_version).toBe(INPUT_EXPORT_SCHEMA_VERSION)
    expect(payload.boundary).toBe('EXPORT_INPUT_TABLES')
    expect(payload.household_id).toBe('hh-1')
    expect(Object.keys(payload.tables).sort()).toEqual([...EXPORT_INPUT_TABLES].sort())

    for (const denied of EXPORT_COMPUTED_DENYLIST) {
      expect(payload.tables).not.toHaveProperty(denied)
    }
  })

  test('scopes every table query to the authenticated owner', async () => {
    const eqCalls: { table: string; column: string; value: string }[] = []
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, value: string) => {
            eqCalls.push({ table, column, value })
            return Promise.resolve({ data: [], error: null })
          },
        }),
      }),
    }

    await loadInputExportPayload(supabase as never, 'owner-abc')

    expect(eqCalls.map((c) => c.table).sort()).toEqual([...EXPORT_INPUT_TABLES].sort())
    for (const call of eqCalls) {
      expect(call.value).toBe('owner-abc')
      expect(['owner_id', 'user_id']).toContain(call.column)
    }
    expect(eqCalls.find((c) => c.table === 'insurance_policies')?.column).toBe('user_id')
  })
})

test.describe('input export boundary audit', () => {
  test('loader imports EXPORT_INPUT_TABLES from inputComputedBoundary — no parallel list', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/export/loadInputExportPayload.ts'),
      'utf8',
    )
    expect(src).toContain("from '@/lib/access/inputComputedBoundary'")
    expect(src).toContain('EXPORT_INPUT_TABLES')
    expect(src).not.toMatch(/const\s+EXPORT_TABLES\s*=/)
  })

  test('route has no household id parameter — auth.uid() scope only', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/consumer/data-export/route.ts'),
      'utf8',
    )
    expect(src).toContain('loadInputExportPayload(supabase, user.id)')
    expect(src).not.toMatch(/searchParams|householdId|household_id.*req/)
  })
})

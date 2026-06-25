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
  test('loader queries exactly EXPORT_INPUT_TABLES — no hardcoded extra tables', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/export/loadInputExportPayload.ts'),
      'utf8',
    )

    const literalTables = [...src.matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(
      literalTables,
      `hardcoded .from('…') tables must be empty — use EXPORT_INPUT_TABLES loop only: ${literalTables.join(', ')}`,
    ).toEqual([])

    expect(src).toMatch(/for\s*\(\s*const table of EXPORT_INPUT_TABLES\s*\)/)
    expect(src).not.toMatch(/const\s+(EXPORT_TABLES|INPUT_TABLES)\s*=/)
  })

  test('runtime query set equals EXPORT_INPUT_TABLES — bidirectional, not subset', async () => {
    const touched = new Set<string>()
    const supabase = {
      from: (table: string) => {
        touched.add(table)
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      },
    }
    await loadInputExportPayload(supabase as never, 'audit-user')

    const queried = [...touched].sort()
    const expected = [...EXPORT_INPUT_TABLES].sort()
    expect(queried).toEqual(expected)
    expect(queried.length).toBe(expected.length)
  })

  test('export omits computed artifacts when DB has computed rows for the user', async () => {
    const userId = 'user-with-computed-cache'
    const computedArtifacts = {
      estate_composition_cache: [{ id: 'ecc-1', household_id: 'hh-1', payload: { leaked: true } }],
      monte_carlo_summaries: [{ id: 'mc-1', household_id: 'hh-1', p50: 1_000_000 }],
      projections: [{ id: 'proj-1', household_id: 'hh-1', label: 'base' }],
    }
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: async () => ({
            data:
              table in computedArtifacts
                ? computedArtifacts[table as keyof typeof computedArtifacts]
                : table === 'households'
                  ? [{ id: 'hh-1', owner_id: userId, name: 'Computed household' }]
                  : [],
            error: null,
          }),
        }),
      }),
    }

    const payload = await loadInputExportPayload(supabase as never, userId)
    const serialized = JSON.stringify(payload)

    expect(Object.keys(payload.tables).sort()).toEqual([...EXPORT_INPUT_TABLES].sort())
    for (const denied of EXPORT_COMPUTED_DENYLIST) {
      expect(payload.tables).not.toHaveProperty(denied)
    }
    expect(serialized).not.toContain('ecc-1')
    expect(serialized).not.toContain('mc-1')
    expect(serialized).not.toContain('proj-1')
    expect(serialized).not.toContain('leaked')
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

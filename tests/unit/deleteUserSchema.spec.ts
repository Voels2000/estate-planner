/**
 * Schema drift classification for deleteUserData (WCPA deletion path).
 * Run: npx playwright test tests/unit/deleteUserSchema.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  classifySchemaDeleteError,
  formatSchemaDeleteSkips,
} from '../../lib/compliance/deleteUserSchema'

test.describe('classifySchemaDeleteError', () => {
  test('missing table → skip (non-fatal)', () => {
    const result = classifySchemaDeleteError(
      'beneficiaries',
      'owner_id',
      "Could not find the table 'public.beneficiaries' in the schema cache",
    )
    expect(result).not.toBe('fatal')
    if (result === 'fatal') return
    expect(result.kind).toBe('missing_table')
    expect(result.table).toBe('beneficiaries')
  })

  test('missing column → schema drift (must abort)', () => {
    const result = classifySchemaDeleteError(
      'asset_beneficiaries',
      'household_id',
      'column asset_beneficiaries.household_id does not exist',
    )
    expect(result).not.toBe('fatal')
    if (result === 'fatal') return
    expect(result.kind).toBe('missing_column')
    expect(result.column).toBe('household_id')
  })

  test('unknown error → fatal', () => {
    expect(
      classifySchemaDeleteError('profiles', 'id', 'permission denied for table profiles'),
    ).toBe('fatal')
  })
})

test.describe('formatSchemaDeleteSkips', () => {
  test('joins skips for audit log', () => {
    expect(
      formatSchemaDeleteSkips([
        {
          table: 'beneficiaries',
          column: 'owner_id',
          kind: 'missing_table',
          detail: 'gone',
        },
        {
          table: 'asset_beneficiaries',
          column: 'household_id',
          kind: 'missing_column',
          detail: 'wrong col',
        },
      ]),
    ).toBe(
      'beneficiaries.owner_id (missing_table); asset_beneficiaries.household_id (missing_column)',
    )
  })
})

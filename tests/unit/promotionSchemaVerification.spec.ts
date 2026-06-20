/**
 * Promotion schema gate — URL resolution only (SQL runs against live DB in verify script).
 * Run: npx playwright test tests/unit/promotionSchemaVerification.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { resolvePromotionDbUrl } from '../../lib/verify/runPromotionSchemaVerification'

test.describe('resolvePromotionDbUrl', () => {
  test('production prefers PROD_SUPABASE_DB_URL', () => {
    const prev = { ...process.env }
    process.env.PROD_SUPABASE_DB_URL = 'postgresql://prod'
    process.env.SUPABASE_DB_URL = 'postgresql://fallback'
    expect(resolvePromotionDbUrl('production')).toBe('postgresql://prod')
    process.env = prev
  })

  test('staging prefers STAGING_SUPABASE_DB_URL', () => {
    const prev = { ...process.env }
    process.env.STAGING_SUPABASE_DB_URL = 'postgresql://staging'
    process.env.SUPABASE_DB_URL = 'postgresql://fallback'
    expect(resolvePromotionDbUrl('staging')).toBe('postgresql://staging')
    process.env = prev
  })
})

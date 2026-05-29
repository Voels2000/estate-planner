/**
 * Rate limit helper unit tests
 * Run: npx playwright test tests/unit/simpleRateLimit.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { checkRateLimit } from '../../lib/api/simpleRateLimit'

test.describe('checkRateLimit', () => {
  test('allows requests under the cap', () => {
    const key = `test-${Date.now()}-a`
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
  })

  test('blocks when cap exceeded', () => {
    const key = `test-${Date.now()}-b`
    checkRateLimit(key, 2, 60_000)
    checkRateLimit(key, 2, 60_000)
    const blocked = checkRateLimit(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})

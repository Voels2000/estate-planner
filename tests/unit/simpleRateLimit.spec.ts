/**
 * Rate limit helper unit tests
 * Run: npx playwright test tests/unit/simpleRateLimit.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { checkRateLimitSync } from '../../lib/api/simpleRateLimit'

test.describe('checkRateLimitSync', () => {
  test('allows requests under the cap', () => {
    const key = `test-${Date.now()}-a`
    expect(checkRateLimitSync(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimitSync(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimitSync(key, 3, 60_000).allowed).toBe(true)
  })

  test('blocks when cap exceeded', () => {
    const key = `test-${Date.now()}-b`
    checkRateLimitSync(key, 2, 60_000)
    checkRateLimitSync(key, 2, 60_000)
    const blocked = checkRateLimitSync(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})

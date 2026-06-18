/**
 * Shared secret auth helpers — fail-closed regression for recompute.
 * Run: npx playwright test tests/unit/internalApiAuth.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  requireHeaderSecretAuth,
  requireRecomputeAuth,
  safeCompareSecrets,
} from '../../lib/api/internalApiAuth'

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/recompute-estate-health', {
    method: 'POST',
    headers,
  })
}

test.describe('safeCompareSecrets', () => {
  test('matches equal strings', () => {
    expect(safeCompareSecrets('abc', 'abc')).toBe(true)
  })

  test('rejects unequal strings', () => {
    expect(safeCompareSecrets('abc', 'abd')).toBe(false)
  })

  test('rejects unequal lengths without throwing', () => {
    expect(safeCompareSecrets('short', 'much-longer-value')).toBe(false)
  })
})

test.describe('requireHeaderSecretAuth', () => {
  test('returns 500 when expected secret unset (fail-open regression)', async () => {
    const res = requireHeaderSecretAuth('', undefined)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(500)
    expect(await res!.json()).toEqual({ error: 'Server misconfigured' })
  })

  test('returns 403 when provided secret wrong', async () => {
    const res = requireHeaderSecretAuth('wrong', 'expected-secret')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  test('returns null when secrets match', () => {
    expect(requireHeaderSecretAuth('same', 'same')).toBeNull()
  })
})

test.describe('requireRecomputeAuth', () => {
  const envKey = 'RECOMPUTE_SECRET'

  test('returns 500 when env unset — no and empty header (fail-open regression)', () => {
    const prior = process.env[envKey]
    delete process.env[envKey]
    try {
      expect(requireRecomputeAuth(req())).not.toBeNull()
      expect(requireRecomputeAuth(req())!.status).toBe(500)
      expect(requireRecomputeAuth(req({ 'x-recompute-secret': '' }))!.status).toBe(500)
      expect(requireRecomputeAuth(req({ 'x-recompute-secret': 'anything' }))!.status).toBe(500)
    } finally {
      if (prior !== undefined) process.env[envKey] = prior
    }
  })

  test('returns 403 when env set but header missing or wrong', async () => {
    const prior = process.env[envKey]
    process.env[envKey] = 'test-recompute-secret'
    try {
      const missing = requireRecomputeAuth(req())
      expect(missing!.status).toBe(403)
      expect(await missing!.json()).toEqual({ error: 'Forbidden' })

      const wrong = requireRecomputeAuth(req({ 'x-recompute-secret': 'bad' }))
      expect(wrong!.status).toBe(403)
    } finally {
      if (prior !== undefined) process.env[envKey] = prior
      else delete process.env[envKey]
    }
  })

  test('returns null when header matches env', () => {
    const prior = process.env[envKey]
    process.env[envKey] = 'test-recompute-secret'
    try {
      expect(
        requireRecomputeAuth(req({ 'x-recompute-secret': 'test-recompute-secret' })),
      ).toBeNull()
    } finally {
      if (prior !== undefined) process.env[envKey] = prior
      else delete process.env[envKey]
    }
  })
})

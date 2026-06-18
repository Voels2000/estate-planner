import { test, expect } from '@playwright/test'

/**
 * Recompute route auth — uses x-recompute-secret (same as triggerEstateHealthRecompute).
 * Fail-open when RECOMPUTE_SECRET unset is covered in tests/unit/internalApiAuth.spec.ts.
 */
test.describe('Recompute estate health route auth', () => {
  test('POST /api/recompute-estate-health rejects missing secret when env set', async ({
    request,
  }) => {
    const secret = process.env.RECOMPUTE_SECRET?.trim()
    test.skip(!secret, 'RECOMPUTE_SECRET not set in test environment')

    const res = await request.post('/api/recompute-estate-health', {
      data: { householdId: '00000000-0000-4000-8000-000000000001' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  test('POST /api/recompute-estate-health rejects wrong secret when env set', async ({
    request,
  }) => {
    const secret = process.env.RECOMPUTE_SECRET?.trim()
    test.skip(!secret, 'RECOMPUTE_SECRET not set in test environment')

    const res = await request.post('/api/recompute-estate-health', {
      data: { householdId: '00000000-0000-4000-8000-000000000001' },
      headers: {
        'Content-Type': 'application/json',
        'x-recompute-secret': 'definitely-not-the-real-secret',
      },
    })
    expect(res.status()).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  test('POST /api/recompute-estate-health accepts valid secret and reaches handler', async ({
    request,
  }) => {
    const secret = process.env.RECOMPUTE_SECRET?.trim()
    test.skip(!secret, 'RECOMPUTE_SECRET not set in test environment')

    const res = await request.post('/api/recompute-estate-health', {
      data: { householdId: '00000000-0000-4000-8000-000000000099' },
      headers: {
        'Content-Type': 'application/json',
        'x-recompute-secret': secret!,
      },
    })
    // Auth passed — unknown household → 404 (not 403/500 from guard)
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
})

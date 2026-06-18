/**
 * Email unsubscribe routing — advisor, attorney, and capture must hit distinct tables.
 * Run: npx playwright test tests/unit/applyEmailUnsubscribe.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyEmailUnsubscribe,
  emailUnsubscribeUpdateTarget,
  parseEmailUnsubscribeType,
} from '../../lib/email/applyEmailUnsubscribe'
import { buildUnsubscribeUrl, verifyUnsubscribeToken } from '../../lib/email/unsubscribeToken'

type RecordedUpdate = {
  table: string
  column: string
  value: string
  email: string
}

function mockAdmin(options?: {
  profilesError?: string | null
  emailCapturesError?: string | null
}) {
  const updates: RecordedUpdate[] = []
  let currentTable = ''
  let currentPayload: Record<string, unknown> = {}

  const chain = {
    update: (payload: Record<string, unknown>) => {
      currentPayload = payload
      return chain
    },
    eq: (_col: string, email: string) => {
      const column = Object.keys(currentPayload)[0] ?? ''
      updates.push({
        table: currentTable,
        column,
        value: String(currentPayload[column] ?? ''),
        email,
      })
      const error =
        currentTable === 'profiles'
          ? options?.profilesError ?? null
          : options?.emailCapturesError ?? null
      return Promise.resolve({ data: null, error: error ? { message: error } : null, count: 1 })
    },
  }

  const admin = {
    from: (table: string) => {
      currentTable = table
      return chain
    },
  } as unknown as SupabaseClient

  return { admin, updates }
}

test.describe('parseEmailUnsubscribeType', () => {
  test('absent type param is capture', () => {
    expect(parseEmailUnsubscribeType(null)).toBe('capture')
  })

  test('advisor and attorney are recognized', () => {
    expect(parseEmailUnsubscribeType('advisor')).toBe('advisor')
    expect(parseEmailUnsubscribeType('attorney')).toBe('attorney')
  })

  test('unknown type is invalid', () => {
    expect(parseEmailUnsubscribeType('consumer')).toBe('invalid')
    expect(parseEmailUnsubscribeType('')).toBe('invalid')
  })
})

test.describe('applyEmailUnsubscribe', () => {
  test('advisor writes profiles.advisor_drip_unsubscribed_at, not email_captures', async () => {
    const { admin, updates } = mockAdmin()
    const result = await applyEmailUnsubscribe(admin, 'advisor', 'Advisor@Example.com')

    expect(result.ok).toBe(true)
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('profiles')
    expect(updates[0].column).toBe('advisor_drip_unsubscribed_at')
    expect(updates[0].email).toBe('advisor@example.com')
    expect(updates[0].value.length).toBeGreaterThan(0)
    expect(updates.some((u) => u.table === 'email_captures')).toBe(false)
  })

  test('attorney writes profiles.attorney_drip_unsubscribed_at, not email_captures', async () => {
    const { admin, updates } = mockAdmin()
    const result = await applyEmailUnsubscribe(admin, 'attorney', 'attorney@example.com')

    expect(result.ok).toBe(true)
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('profiles')
    expect(updates[0].column).toBe('attorney_drip_unsubscribed_at')
    expect(updates[0].email).toBe('attorney@example.com')
    expect(updates.some((u) => u.table === 'email_captures')).toBe(false)
  })

  test('capture writes email_captures.unsubscribed_at only', async () => {
    const { admin, updates } = mockAdmin()
    const result = await applyEmailUnsubscribe(admin, 'capture', 'waitlist@example.com')

    expect(result.ok).toBe(true)
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('email_captures')
    expect(updates[0].column).toBe('unsubscribed_at')
    expect(updates[0].email).toBe('waitlist@example.com')
    expect(updates.some((u) => u.table === 'profiles')).toBe(false)
  })

  test('attorney DB error returns failure without success', async () => {
    const { admin, updates } = mockAdmin({ profilesError: 'write failed' })
    const result = await applyEmailUnsubscribe(admin, 'attorney', 'attorney@example.com')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('write failed')
    expect(updates[0].column).toBe('attorney_drip_unsubscribed_at')
  })
})

test.describe('verifyUnsubscribeToken — per type', () => {
  const envKey = 'CRON_SECRET'
  const restore: Array<() => void> = []

  test.beforeEach(() => {
    const prev = process.env[envKey]
    process.env[envKey] = 'test-unsubscribe-secret'
    restore.push(() => {
      if (prev === undefined) delete process.env[envKey]
      else process.env[envKey] = prev
    })
  })

  test.afterEach(() => {
    while (restore.length) restore.pop()?.()
  })

  for (const type of ['advisor', 'attorney', 'capture'] as const) {
    test(`rejects tampered token for ${type}`, () => {
      const email = `${type}@example.com`
      const verifyArg = type === 'capture' ? null : type
      const url = buildUnsubscribeUrl('https://app.test', email, verifyArg ?? undefined)
      const parsed = new URL(url)
      expect(
        verifyUnsubscribeToken(
          email,
          `${parsed.searchParams.get('token')}x`,
          verifyArg,
        ),
      ).toBe(false)
    })

    test(`accepts valid token for ${type}`, () => {
      const email = `${type}@example.com`
      const verifyArg = type === 'capture' ? null : type
      const url = buildUnsubscribeUrl('https://app.test', email, verifyArg ?? undefined)
      const parsed = new URL(url)
      expect(
        verifyUnsubscribeToken(email, parsed.searchParams.get('token'), verifyArg),
      ).toBe(true)
    })
  }
})

test.describe('emailUnsubscribeUpdateTarget', () => {
  test('maps each type to the column the drip sender must honor', () => {
    expect(emailUnsubscribeUpdateTarget('advisor', 'a@b.com').column).toBe(
      'advisor_drip_unsubscribed_at',
    )
    expect(emailUnsubscribeUpdateTarget('attorney', 'a@b.com').column).toBe(
      'attorney_drip_unsubscribed_at',
    )
    expect(emailUnsubscribeUpdateTarget('capture', 'a@b.com').column).toBe('unsubscribed_at')
  })
})

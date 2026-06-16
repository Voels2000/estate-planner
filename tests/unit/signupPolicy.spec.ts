/**
 * Signup policy + email-confirm matrix
 * Run: npx playwright test tests/unit/signupPolicy.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  resolveEmailConfirmForCreateUser,
  validateSignupAdmission,
} from '../../lib/auth/signupAdmission'
import {
  SIGNUP_PASSWORD_MIN_INVITE,
  SIGNUP_PASSWORD_MIN_OPEN,
  SIGNUP_PASSWORD_MIN_PRIVILEGED,
  sanitizeSignupRedirect,
  validateSignupPassword,
  signupPasswordMinLength,
} from '../../lib/auth/signupPolicy'
import type { SupabaseClient } from '@supabase/supabase-js'

function mockAdmin(): SupabaseClient {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'not', 'order', 'limit'] as const) {
    chain[m] = () => chain
  }
  chain.maybeSingle = async () => ({ data: null, error: null })
  return { from: () => chain } as unknown as SupabaseClient
}

test.describe('open_consumer × signup-open state', () => {
  const restore: Array<() => void> = []

  function setEnv(key: string, value: string | undefined) {
    const prev = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    restore.push(() => {
      if (prev === undefined) delete process.env[key]
      else process.env[key] = prev
    })
  }

  test.afterEach(() => {
    while (restore.length) restore.pop()?.()
  })

  test('dark: open_consumer → 403 when PUBLIC_SIGNUP_OPEN unset', async () => {
    setEnv('PUBLIC_SIGNUP_OPEN', undefined)
    setEnv('NEXT_PUBLIC_SIGNUP_OPEN', undefined)
    const result = await validateSignupAdmission(
      mockAdmin(),
      { type: 'open_consumer' },
      { email: 'new@example.com', role: 'consumer' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  test('bright: open_consumer → ok when PUBLIC_SIGNUP_OPEN=true', async () => {
    setEnv('PUBLIC_SIGNUP_OPEN', 'true')
    const result = await validateSignupAdmission(
      mockAdmin(),
      { type: 'open_consumer' },
      { email: 'new@example.com', role: 'consumer' },
    )
    expect(result.ok).toBe(true)
  })

  test('bright: open_consumer rejects non-consumer role', async () => {
    setEnv('PUBLIC_SIGNUP_OPEN', 'true')
    const result = await validateSignupAdmission(
      mockAdmin(),
      { type: 'open_consumer' },
      { email: 'new@example.com', role: 'advisor' },
    )
    expect(result.ok).toBe(false)
  })
})

test.describe('email_confirm matrix (admin.createUser flag)', () => {
  const restore: Array<() => void> = []

  function setEnv(key: string, value: string | undefined) {
    const prev = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    restore.push(() => {
      if (prev === undefined) delete process.env[key]
      else process.env[key] = prev
    })
  }

  test.afterEach(() => {
    while (restore.length) restore.pop()?.()
  })

  test('open_consumer on prod marketing → email_confirm false (must verify)', () => {
    setEnv('SIGNUP_SKIP_EMAIL_CONFIRM', undefined)
    expect(
      resolveEmailConfirmForCreateUser({ type: 'open_consumer' }, 'www.mywealthmaps.com'),
    ).toBe(false)
  })

  test('open_consumer on staging host → email_confirm false by default', () => {
    setEnv('SIGNUP_SKIP_EMAIL_CONFIRM', undefined)
    expect(
      resolveEmailConfirmForCreateUser(
        { type: 'open_consumer' },
        'staging.mywealthmaps.com',
      ),
    ).toBe(false)
  })

  test('open_consumer with SIGNUP_SKIP_EMAIL_CONFIRM → true (E2E only)', () => {
    setEnv('SIGNUP_SKIP_EMAIL_CONFIRM', 'true')
    expect(
      resolveEmailConfirmForCreateUser({ type: 'open_consumer' }, 'staging.example.com'),
    ).toBe(true)
  })

  test('beta_access → email_confirm true (immediate session)', () => {
    expect(resolveEmailConfirmForCreateUser({ type: 'beta_access' }, 'www.mywealthmaps.com')).toBe(
      true,
    )
  })

  test('firm_member_invite → email_confirm true', () => {
    expect(
      resolveEmailConfirmForCreateUser(
        { type: 'firm_member_invite', firmInviteToken: 't', firmId: 'f' },
        'www.mywealthmaps.com',
      ),
    ).toBe(true)
  })
})

test.describe('password policy', () => {
  test('open_consumer requires 8+ characters', () => {
    expect(validateSignupPassword('short1', { type: 'open_consumer' })).toContain('8')
    expect(validateSignupPassword('longenough', { type: 'open_consumer' })).toBeNull()
  })

  test('invite consumer flows require 8+ characters', () => {
    expect(validateSignupPassword('six6ok', { type: 'beta_access' }, 'consumer')).toContain('8')
    expect(validateSignupPassword('eight888', { type: 'beta_access' }, 'consumer')).toBeNull()
  })

  test('advisor/attorney signups require 10+ characters', () => {
    expect(validateSignupPassword('eight888', { type: 'beta_access' }, 'advisor')).toContain('10')
    expect(validateSignupPassword('tenchars00', { type: 'open_advisor' }, 'advisor')).toBeNull()
    expect(
      validateSignupPassword('tenchars00', { type: 'firm_member_invite', firmInviteToken: 't', firmId: 'f' }),
    ).toBeNull()
  })

  test('constants match policy', () => {
    expect(SIGNUP_PASSWORD_MIN_OPEN).toBe(8)
    expect(SIGNUP_PASSWORD_MIN_INVITE).toBe(8)
    expect(SIGNUP_PASSWORD_MIN_PRIVILEGED).toBe(10)
    expect(signupPasswordMinLength({ type: 'open_consumer' })).toBe(8)
    expect(signupPasswordMinLength({ type: 'beta_access' }, 'advisor')).toBe(10)
  })
})

test.describe('redirect sanitization', () => {
  test('allows in-app paths only', () => {
    expect(sanitizeSignupRedirect('/dashboard')).toBe('/dashboard')
    expect(sanitizeSignupRedirect('//evil.com')).toBeUndefined()
    expect(sanitizeSignupRedirect('/login?next=//evil')).toBe('/login?next=//evil')
    expect(sanitizeSignupRedirect('https://evil.com')).toBeUndefined()
  })
})

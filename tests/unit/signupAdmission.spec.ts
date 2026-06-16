/**
 * Server-gated signup admission validation
 * Run: npx playwright test tests/unit/signupAdmission.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  validateSignupAdmission,
  inferSignupAdmissionFromClient,
  resolveEffectiveSignupRole,
  constantTimeEqual,
} from '../../lib/auth/signupAdmission'
import type { SupabaseClient } from '@supabase/supabase-js'

function createQueryChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'not', 'order', 'limit'] as const) {
    chain[method] = () => chain
  }
  chain.maybeSingle = async () => result
  return chain
}

function mockAdmin(queryResult: { data: unknown; error: null }): SupabaseClient {
  return {
    from: () => createQueryChain(queryResult),
  } as unknown as SupabaseClient
}

test.describe('validateSignupAdmission', () => {
  test('open_consumer denied when signup closed', async () => {
    const prev = process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
    try {
      const result = await validateSignupAdmission(
        mockAdmin({ data: null, error: null }),
        { type: 'open_consumer' },
        { email: 'new@example.com', role: 'consumer' },
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(403)
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prev
    }
  })

  test('open_consumer allowed when signup open', async () => {
    const prev = process.env.PUBLIC_SIGNUP_OPEN
    process.env.PUBLIC_SIGNUP_OPEN = 'true'
    try {
      const result = await validateSignupAdmission(
        mockAdmin({ data: null, error: null }),
        { type: 'open_consumer' },
        { email: 'new@example.com', role: 'consumer' },
      )
      expect(result.ok).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prev
    }
  })

  test('beta_access rejects invalid token', async () => {
    const prev = process.env.BETA_SIGNUP_TOKEN
    process.env.BETA_SIGNUP_TOKEN = 'secret-token'
    try {
      const result = await validateSignupAdmission(
        mockAdmin({ data: null, error: null }),
        { type: 'beta_access', access: 'wrong' },
        { email: 'friend@example.com', role: 'consumer' },
      )
      expect(result.ok).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.BETA_SIGNUP_TOKEN
      else process.env.BETA_SIGNUP_TOKEN = prev
    }
  })

  test('beta_access accepts valid token', async () => {
    const prev = process.env.BETA_SIGNUP_TOKEN
    process.env.BETA_SIGNUP_TOKEN = 'secret-token'
    try {
      const result = await validateSignupAdmission(
        mockAdmin({ data: null, error: null }),
        { type: 'beta_access', access: 'secret-token' },
        { email: 'friend@example.com', role: 'consumer' },
      )
      expect(result.ok).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.BETA_SIGNUP_TOKEN
      else process.env.BETA_SIGNUP_TOKEN = prev
    }
  })

  test('advisor_client_invite requires matching email', async () => {
    const admin = mockAdmin({
      data: {
        invited_email: 'client@example.com',
        status: 'pending',
        invite_expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    })
    const bad = await validateSignupAdmission(
      admin,
      { type: 'advisor_client_invite', inviteToken: 'tok123' },
      { email: 'other@example.com', role: 'consumer' },
    )
    expect(bad.ok).toBe(false)

    const good = await validateSignupAdmission(
      admin,
      { type: 'advisor_client_invite', inviteToken: 'tok123' },
      { email: 'client@example.com', role: 'consumer' },
    )
    expect(good.ok).toBe(true)
  })
})

test.describe('inferSignupAdmissionFromClient', () => {
  test('maps query-shaped inputs to admission types', () => {
    expect(
      inferSignupAdmissionFromClient({
        betaAccessActive: true,
        betaAccessToken: 'tok',
        signupOpen: false,
      }).type,
    ).toBe('beta_access')

    expect(
      inferSignupAdmissionFromClient({
        advisorInviteToken: 'inv',
        signupOpen: false,
      }).type,
    ).toBe('advisor_client_invite')

    expect(
      inferSignupAdmissionFromClient({
        signupOpen: true,
      }).type,
    ).toBe('open_consumer')
  })
})

test.describe('resolveEffectiveSignupRole', () => {
  test('advisor client invite forces consumer role', () => {
    expect(
      resolveEffectiveSignupRole('advisor', { type: 'advisor_client_invite' }),
    ).toBe('consumer')
  })
})

test.describe('constantTimeEqual', () => {
  test('matches equal strings only', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('a', 'ab')).toBe(false)
  })
})

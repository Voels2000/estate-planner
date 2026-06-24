import { test, expect } from '@playwright/test'
import { sendSignupConfirmationEmail } from '@/lib/auth/sendSignupConfirmationEmail'

test.describe('sendSignupConfirmationEmail', () => {
  test('calls Supabase resend with signup type and redirect', async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; init?: RequestInit }> = []

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'

    globalThis.fetch = async (input, init) => {
      calls.push({
        url: typeof input === 'string' ? input : input.url,
        init,
      })
      return new Response('{}', { status: 200 })
    }

    try {
      const result = await sendSignupConfirmationEmail(
        'user@example.com',
        'https://staging.example.com/auth/callback',
      )

      expect(result).toEqual({ ok: true })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://example.supabase.co/auth/v1/resend')
      expect(calls[0]?.init?.method).toBe('POST')
      expect(calls[0]?.init?.headers).toMatchObject({
        apikey: 'anon-test-key',
        Authorization: 'Bearer anon-test-key',
      })

      const body = JSON.parse(String(calls[0]?.init?.body))
      expect(body).toEqual({
        type: 'signup',
        email: 'user@example.com',
        options: { emailRedirectTo: 'https://staging.example.com/auth/callback' },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('returns error when resend fails', async () => {
    const originalFetch = globalThis.fetch
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'

    globalThis.fetch = async () =>
      new Response('{"msg":"rate limited"}', { status: 429 })

    try {
      const result = await sendSignupConfirmationEmail(
        'user@example.com',
        'https://staging.example.com/auth/callback',
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('rate limited')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

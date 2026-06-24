process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? 're_test_key'

import { test, expect } from '@playwright/test'
import { resend } from '@/lib/resend'
import { sendSignupConfirmationEmail } from '@/lib/email/sendSignupConfirmationEmail'
import { buildSignupConfirmUrl, getSiteUrl } from '@/lib/site-url'

test.describe('site-url', () => {
  test('getSiteUrl normalizes NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://estate-planner-staging.vercel.app/'
    expect(getSiteUrl()).toBe('https://estate-planner-staging.vercel.app')
  })

  test('buildSignupConfirmUrl points at prefetch-safe confirm page', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://estate-planner-staging.vercel.app'
    const url = buildSignupConfirmUrl('abc123hash')
    expect(url).toBe(
      'https://estate-planner-staging.vercel.app/auth/confirm?token_hash=abc123hash&type=signup',
    )
  })
})

test.describe('sendSignupConfirmationEmail', () => {
  test('sends branded Resend mail with confirm URL', async () => {
    const originalSend = resend.emails.send
    const calls: Parameters<typeof resend.emails.send>[] = []

    resend.emails.send = (async (...args) => {
      calls.push(args)
      return { data: { id: 'test-id' }, error: null }
    }) as typeof resend.emails.send

    try {
      await sendSignupConfirmationEmail({
        to: 'user@example.com',
        confirmUrl: 'https://staging.example.com/auth/confirm?token_hash=x&type=signup',
        name: 'Alan',
      })

      expect(calls).toHaveLength(1)
      expect(calls[0]?.[0]).toMatchObject({
        from: 'My Wealth Maps <noreply@mywealthmaps.com>',
        to: 'user@example.com',
        subject: 'Confirm your email to start your My Wealth Maps estate plan',
      })
      expect(String(calls[0]?.[0]?.html)).toContain('My Wealth Maps')
      expect(String(calls[0]?.[0]?.html)).toContain('auth/confirm')
    } finally {
      resend.emails.send = originalSend
    }
  })

  test('throws when Resend fails', async () => {
    const originalSend = resend.emails.send

    resend.emails.send = (async () => ({
      data: null,
      error: { message: 'rate limited', name: 'rate_limit' },
    })) as unknown as typeof resend.emails.send

    try {
      await expect(
        sendSignupConfirmationEmail({
          to: 'user@example.com',
          confirmUrl: 'https://staging.example.com/auth/confirm?token_hash=x&type=signup',
        }),
      ).rejects.toThrow(/rate limited/)
    } finally {
      resend.emails.send = originalSend
    }
  })
})

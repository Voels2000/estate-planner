import { test, expect } from '@playwright/test'
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

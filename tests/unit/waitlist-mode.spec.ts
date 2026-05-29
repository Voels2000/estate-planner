/**
 * Waitlist mode — server/client parity
 * Run: npx playwright test tests/unit/waitlist-mode.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { isWaitlistMode, getSignupHref } from '../../lib/waitlist-mode'

test.describe('isWaitlistMode', () => {
  const prodHost = { hostname: 'mywealthmaps.com' }

  test('uses NEXT_PUBLIC_WAITLIST_MODE when set (not server-only VERCEL_ENV)', () => {
    const prevWaitlist = process.env.NEXT_PUBLIC_WAITLIST_MODE
    const prevVercel = process.env.VERCEL_ENV
    const prevOpen = process.env.PUBLIC_SIGNUP_OPEN
    const prevPublicOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    const prevWaitlistMode = process.env.WAITLIST_MODE
    process.env.NEXT_PUBLIC_WAITLIST_MODE = 'true'
    delete process.env.VERCEL_ENV
    delete process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
    delete process.env.WAITLIST_MODE
    try {
      expect(isWaitlistMode(prodHost)).toBe(true)
    } finally {
      if (prevWaitlist === undefined) delete process.env.NEXT_PUBLIC_WAITLIST_MODE
      else process.env.NEXT_PUBLIC_WAITLIST_MODE = prevWaitlist
      if (prevVercel === undefined) delete process.env.VERCEL_ENV
      else process.env.VERCEL_ENV = prevVercel
      if (prevOpen === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prevOpen
      if (prevPublicOpen === undefined) delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
      else process.env.NEXT_PUBLIC_SIGNUP_OPEN = prevPublicOpen
      if (prevWaitlistMode === undefined) delete process.env.WAITLIST_MODE
      else process.env.WAITLIST_MODE = prevWaitlistMode
    }
  })

  test('NEXT_PUBLIC_SIGNUP_OPEN disables waitlist', () => {
    const prevOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    const prevWaitlist = process.env.NEXT_PUBLIC_WAITLIST_MODE
    process.env.NEXT_PUBLIC_SIGNUP_OPEN = 'true'
    process.env.NEXT_PUBLIC_WAITLIST_MODE = 'true'
    try {
      expect(isWaitlistMode(prodHost)).toBe(false)
      expect(getSignupHref(prodHost)).toBe('/signup')
    } finally {
      if (prevOpen === undefined) delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
      else process.env.NEXT_PUBLIC_SIGNUP_OPEN = prevOpen
      if (prevWaitlist === undefined) delete process.env.NEXT_PUBLIC_WAITLIST_MODE
      else process.env.NEXT_PUBLIC_WAITLIST_MODE = prevWaitlist
    }
  })
})

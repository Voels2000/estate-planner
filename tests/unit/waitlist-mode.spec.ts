/**
 * Waitlist mode — server/client parity
 * Run: npx playwright test tests/unit/waitlist-mode.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { isWaitlistMode, getSignupHref, shouldBypassWaitlistForSignup, isValidBetaSignupAccessToken } from '../../lib/waitlist-mode'

test.describe('isWaitlistMode', () => {
  const prodHost = { hostname: 'mywealthmaps.com' }
  const prodWwwHost = { hostname: 'www.mywealthmaps.com' }

  test('production marketing host is waitlisted by default', () => {
    const prevWaitlist = process.env.NEXT_PUBLIC_WAITLIST_MODE
    const prevWaitlistMode = process.env.WAITLIST_MODE
    const prevOpen = process.env.PUBLIC_SIGNUP_OPEN
    const prevPublicOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    process.env.NEXT_PUBLIC_WAITLIST_MODE = 'false'
    process.env.WAITLIST_MODE = 'false'
    delete process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
    try {
      expect(isWaitlistMode(prodHost)).toBe(true)
      expect(isWaitlistMode(prodWwwHost)).toBe(true)
      expect(getSignupHref(prodHost)).toBe('/waitlist')
    } finally {
      if (prevWaitlist === undefined) delete process.env.NEXT_PUBLIC_WAITLIST_MODE
      else process.env.NEXT_PUBLIC_WAITLIST_MODE = prevWaitlist
      if (prevWaitlistMode === undefined) delete process.env.WAITLIST_MODE
      else process.env.WAITLIST_MODE = prevWaitlistMode
      if (prevOpen === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prevOpen
      if (prevPublicOpen === undefined) delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
      else process.env.NEXT_PUBLIC_SIGNUP_OPEN = prevPublicOpen
    }
  })

  test('PUBLIC_SIGNUP_OPEN is the only go-live flip on production marketing host', () => {
    const prevOpen = process.env.PUBLIC_SIGNUP_OPEN
    const prevPublicOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    process.env.PUBLIC_SIGNUP_OPEN = 'true'
    delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
    try {
      expect(isWaitlistMode(prodHost)).toBe(false)
      expect(getSignupHref(prodHost)).toBe('/signup')
    } finally {
      if (prevOpen === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prevOpen
      if (prevPublicOpen === undefined) delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
      else process.env.NEXT_PUBLIC_SIGNUP_OPEN = prevPublicOpen
    }
  })

  test('NEXT_PUBLIC_SIGNUP_OPEN disables waitlist on production marketing host', () => {
    const prevOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    const prevPublicOpen = process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.PUBLIC_SIGNUP_OPEN
    process.env.NEXT_PUBLIC_SIGNUP_OPEN = 'true'
    try {
      expect(isWaitlistMode(prodHost)).toBe(false)
      expect(getSignupHref(prodHost)).toBe('/signup')
    } finally {
      if (prevOpen === undefined) delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
      else process.env.NEXT_PUBLIC_SIGNUP_OPEN = prevOpen
      if (prevPublicOpen === undefined) delete process.env.PUBLIC_SIGNUP_OPEN
      else process.env.PUBLIC_SIGNUP_OPEN = prevPublicOpen
    }
  })

  test('preview host falls back to VERCEL_ENV=production when flags unset', () => {
    const prevWaitlist = process.env.NEXT_PUBLIC_WAITLIST_MODE
    const prevVercel = process.env.VERCEL_ENV
    const prevOpen = process.env.PUBLIC_SIGNUP_OPEN
    const prevPublicOpen = process.env.NEXT_PUBLIC_SIGNUP_OPEN
    const prevWaitlistMode = process.env.WAITLIST_MODE
    delete process.env.NEXT_PUBLIC_WAITLIST_MODE
    delete process.env.PUBLIC_SIGNUP_OPEN
    delete process.env.NEXT_PUBLIC_SIGNUP_OPEN
    delete process.env.WAITLIST_MODE
    process.env.VERCEL_ENV = 'production'
    try {
      expect(isWaitlistMode({ hostname: 'estate-planner-gules.vercel.app' })).toBe(true)
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
})

test.describe('private beta signup access', () => {
  const params = (access?: string, label?: string) => {
    const sp = new URLSearchParams()
    if (access) sp.set('access', access)
    if (label) sp.set('label', label)
    return sp
  }

  test('valid access token bypasses waitlist gate', () => {
    const prev = process.env.BETA_SIGNUP_TOKEN
    process.env.BETA_SIGNUP_TOKEN = 'secret-friends-token'
    try {
      expect(isValidBetaSignupAccessToken('secret-friends-token')).toBe(true)
      expect(isValidBetaSignupAccessToken('wrong')).toBe(false)
      expect(
        shouldBypassWaitlistForSignup(params('secret-friends-token', 'friends-june')),
      ).toBe(true)
      expect(shouldBypassWaitlistForSignup(params('wrong'))).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.BETA_SIGNUP_TOKEN
      else process.env.BETA_SIGNUP_TOKEN = prev
    }
  })

  test('beta access cookie bypasses waitlist without query param', () => {
    expect(
      shouldBypassWaitlistForSignup(new URLSearchParams(), { betaAccessCookie: '1' }),
    ).toBe(true)
    expect(
      shouldBypassWaitlistForSignup(new URLSearchParams(), { betaAccessCookie: '0' }),
    ).toBe(false)
  })

  test('invite flows still bypass waitlist', () => {
    expect(shouldBypassWaitlistForSignup(params('x'))).toBe(false)
    const invite = new URLSearchParams({ invite: 'abc' })
    expect(shouldBypassWaitlistForSignup(invite)).toBe(true)
  })
})

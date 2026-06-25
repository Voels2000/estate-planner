import { test, expect } from '@playwright/test'
import { getOrigin, getAppUrl, normalizeAbsoluteOrigin } from '@/lib/app-url'

test.describe('normalizeAbsoluteOrigin', () => {
  test('trims trailing whitespace from origin', () => {
    expect(normalizeAbsoluteOrigin('https://estate-planner-staging.vercel.app ', 'test')).toBe(
      'https://estate-planner-staging.vercel.app',
    )
  })

  test('rejects malformed URL with embedded whitespace before path', () => {
    expect(() =>
      normalizeAbsoluteOrigin('https://estate-planner-staging.vercel.app /billing', 'test'),
    ).toThrow(/malformed URL/)
  })

  test('rejects relative URL', () => {
    expect(() => normalizeAbsoluteOrigin('/billing', 'test')).toThrow(/malformed URL/)
  })

  test('rejects origin with path', () => {
    expect(() =>
      normalizeAbsoluteOrigin('https://example.com/billing', 'test'),
    ).toThrow(/origin only/)
  })
})

test.describe('getOrigin', () => {
  test('uses Origin header when present', () => {
    const req = new Request('https://wrong.example/api/stripe/checkout', {
      headers: { origin: 'https://estate-planner-staging.vercel.app' },
    })
    expect(getOrigin(req)).toBe('https://estate-planner-staging.vercel.app')
  })

  test('trims whitespace from Origin header', () => {
    const req = new Request('https://wrong.example/api/stripe/checkout', {
      headers: { origin: 'https://estate-planner-staging.vercel.app ' },
    })
    expect(getOrigin(req)).toBe('https://estate-planner-staging.vercel.app')
  })

  test('builds origin from Host when Origin is absent', () => {
    const req = new Request('https://estate-planner-staging.vercel.app/api/stripe/checkout', {
      headers: { host: 'estate-planner-staging.vercel.app' },
    })
    expect(getOrigin(req)).toBe('https://estate-planner-staging.vercel.app')
  })

  test('throws on relative or invalid origin', () => {
    const req = new Request('https://example.com/api/stripe/checkout', {
      headers: { origin: '/billing' },
    })
    expect(() => getOrigin(req)).toThrow(/Invalid checkout origin/)
  })
})

test.describe('getAppUrl', () => {
  test('returns normalized origin from env', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://estate-planner-staging.vercel.app '
    try {
      expect(getAppUrl()).toBe('https://estate-planner-staging.vercel.app')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })
})

import { test, expect } from '@playwright/test'
import { getOrigin } from '@/lib/app-url'

test.describe('getOrigin', () => {
  test('uses Origin header when present', () => {
    const req = new Request('https://wrong.example/api/stripe/checkout', {
      headers: { origin: 'https://estate-planner-staging.vercel.app' },
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

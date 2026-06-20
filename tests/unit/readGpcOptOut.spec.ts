/**
 * GPC marketing opt-out detection for server routes.
 * Run: npx playwright test tests/unit/readGpcOptOut.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import { NextRequest } from 'next/server'
import { GPC_OPT_OUT_COOKIE } from '../../lib/privacy/globalPrivacyControl'
import { requestHasGpcMarketingOptOut } from '../../lib/privacy/readGpcOptOut'

function makeRequest(init?: { secGpc?: string; cookie?: string }) {
  const headers = new Headers()
  if (init?.secGpc) headers.set('Sec-GPC', init.secGpc)
  const cookie = init?.cookie ? `${GPC_OPT_OUT_COOKIE}=${init.cookie}` : ''
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest('https://mywealthmaps.com/api/email-capture', { headers })
}

test.describe('requestHasGpcMarketingOptOut', () => {
  test('returns true for Sec-GPC: 1 header', () => {
    expect(requestHasGpcMarketingOptOut(makeRequest({ secGpc: '1' }))).toBe(true)
  })

  test('returns true for mwm_gpc_opt_out cookie', () => {
    expect(requestHasGpcMarketingOptOut(makeRequest({ cookie: '1' }))).toBe(true)
  })

  test('returns false without signal or cookie', () => {
    expect(requestHasGpcMarketingOptOut(makeRequest())).toBe(false)
  })

  test('returns false for Sec-GPC other than 1', () => {
    expect(requestHasGpcMarketingOptOut(makeRequest({ secGpc: '0' }))).toBe(false)
  })
})

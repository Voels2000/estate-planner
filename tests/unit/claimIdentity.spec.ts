import { test, expect } from '@playwright/test'
import { verifyClaimIdentity } from '@/lib/directory/claimIdentity'

test.describe('verifyClaimIdentity', () => {
  test('accepts exact listing email match', () => {
    const result = verifyClaimIdentity(
      'Partner@LawFirm.com',
      'partner@lawfirm.com',
      null,
    )
    expect(result).toEqual({ ok: true, method: 'exact' })
  })

  test('accepts firm domain match via listing email', () => {
    const result = verifyClaimIdentity(
      'associate@lawfirm.com',
      'partner@lawfirm.com',
      null,
    )
    expect(result).toEqual({ ok: true, method: 'domain' })
  })

  test('accepts firm domain match via website', () => {
    const result = verifyClaimIdentity(
      'advisor@wealthmaps.com',
      null,
      'https://www.wealthmaps.com/about',
    )
    expect(result).toEqual({ ok: true, method: 'domain' })
  })

  test('rejects free-mail domains without exact match', () => {
    const result = verifyClaimIdentity('user@gmail.com', 'partner@lawfirm.com', null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.needsReview).toBe(true)
    }
  })

  test('rejects mismatched corporate domains', () => {
    const result = verifyClaimIdentity(
      'user@otherfirm.com',
      'partner@lawfirm.com',
      'https://lawfirm.com',
    )
    expect(result.ok).toBe(false)
  })
})

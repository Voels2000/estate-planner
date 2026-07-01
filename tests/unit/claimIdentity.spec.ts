import { describe, expect, it } from 'vitest'
import { verifyClaimIdentity } from '@/lib/directory/claimIdentity'

describe('verifyClaimIdentity', () => {
  it('accepts exact listing email match', () => {
    const result = verifyClaimIdentity(
      'Partner@LawFirm.com',
      'partner@lawfirm.com',
      null,
    )
    expect(result).toEqual({ ok: true, method: 'exact' })
  })

  it('accepts firm domain match via listing email', () => {
    const result = verifyClaimIdentity(
      'associate@lawfirm.com',
      'partner@lawfirm.com',
      null,
    )
    expect(result).toEqual({ ok: true, method: 'domain' })
  })

  it('accepts firm domain match via website', () => {
    const result = verifyClaimIdentity(
      'advisor@wealthmaps.com',
      null,
      'https://www.wealthmaps.com/about',
    )
    expect(result).toEqual({ ok: true, method: 'domain' })
  })

  it('rejects free-mail domains without exact match', () => {
    const result = verifyClaimIdentity('user@gmail.com', 'partner@lawfirm.com', null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.needsReview).toBe(true)
    }
  })

  it('rejects mismatched corporate domains', () => {
    const result = verifyClaimIdentity(
      'user@otherfirm.com',
      'partner@lawfirm.com',
      'https://lawfirm.com',
    )
    expect(result.ok).toBe(false)
  })
})

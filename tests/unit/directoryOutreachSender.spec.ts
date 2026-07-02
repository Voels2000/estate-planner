import { test, expect } from '@playwright/test'
import {
  buildClaimMagicConfirmUrl,
  claimMagicLinkRedirectTo,
} from '@/lib/auth/generateClaimMagicLink'
import { outreachFirstNameFromContact } from '@/lib/directory/outreachRecipient'
import {
  buildAttorneyDirectoryOutreachEmail,
  buildAdvisorDirectoryOutreachEmail,
} from '@/lib/emails/directory-outreach-templates'

test.describe('generateClaimMagicLink helpers', () => {
  test('claimMagicLinkRedirectTo encodes claim path in next param', () => {
    const url = claimMagicLinkRedirectTo('https://staging.mywealthmaps.com', 'tok_abc123')
    expect(url).toBe(
      'https://staging.mywealthmaps.com/auth/callback?next=%2Fclaim%2Ftok_abc123',
    )
  })

  test('buildClaimMagicConfirmUrl is role-agnostic for attorney and advisor outreach', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.mywealthmaps.com'
    try {
      const attorneyUrl = buildClaimMagicConfirmUrl('hash_att', 'tok_attorney')
      const advisorUrl = buildClaimMagicConfirmUrl('hash_adv', 'tok_advisor')
      expect(new URL(attorneyUrl).searchParams.get('next')).toBe('/claim/tok_attorney')
      expect(new URL(advisorUrl).searchParams.get('next')).toBe('/claim/tok_advisor')
      expect(new URL(attorneyUrl).searchParams.get('type')).toBe('magiclink')
      expect(new URL(advisorUrl).searchParams.get('type')).toBe('magiclink')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })

  test('buildClaimMagicConfirmUrl uses token_hash for server-side verify', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.mywealthmaps.com'
    try {
      const url = buildClaimMagicConfirmUrl('hash_xyz', 'tok_abc123')
      const parsed = new URL(url)
      expect(parsed.pathname).toBe('/auth/confirm')
      expect(parsed.searchParams.get('token_hash')).toBe('hash_xyz')
      expect(parsed.searchParams.get('type')).toBe('magiclink')
      expect(parsed.searchParams.get('next')).toBe('/claim/tok_abc123')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })
})

test.describe('outreachRecipient', () => {
  test('outreachFirstNameFromContact uses first token', () => {
    expect(outreachFirstNameFromContact('Sarah Bowman')).toBe('Sarah')
    expect(outreachFirstNameFromContact(null)).toBe('there')
  })
})

test.describe('directory outreach templates + send shape', () => {
  test('template fields match Resend send contract', () => {
    const fields = {
      firmName: 'Perkins Coie LLP',
      firstName: 'Sarah',
      claimLink: 'https://example.com/auth/v1/verify?token=abc',
      senderName: 'Alan Voels',
    }
    const attorney = buildAttorneyDirectoryOutreachEmail(fields)
    expect(attorney.subject).toContain('Perkins Coie LLP')
    expect(attorney.bodyHtml).toContain(fields.claimLink)
    expect(attorney.bodyText).toContain('first connected client is free')

    const advisor = buildAdvisorDirectoryOutreachEmail(fields)
    expect(advisor.bodyText).toContain('per connected household, not per seat')
  })
})

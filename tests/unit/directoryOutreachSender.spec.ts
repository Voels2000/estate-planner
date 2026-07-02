import { test, expect } from '@playwright/test'
import { claimMagicLinkRedirectTo } from '@/lib/auth/generateClaimMagicLink'
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

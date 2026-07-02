import { test, expect } from '@playwright/test'
import {
  buildAttorneyDirectoryOutreachEmail,
  buildAdvisorDirectoryOutreachEmail,
} from '@/lib/emails/directory-outreach-templates'
import {
  connectionAttorneyPricingBlurb,
  formatConnectionBandTable,
  freeAttorneyClientCapMessage,
  pricingFaqAttorneyFreeLine,
} from '@/lib/copy/connectionBillingMarketing'
import { ATTORNEY_BANDS } from '@/lib/pricing/connectionPricing'

test.describe('connectionBillingMarketing', () => {
  test('band table pulls live rates from connectionPricing', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const table = formatConnectionBandTable(ATTORNEY_BANDS)
    expect(table).toContain('$75/client for 1–10 clients')
    expect(table).toContain('$45/client for 151+ clients')
    expect(connectionAttorneyPricingBlurb()).toContain('First client free')
    expect(pricingFaqAttorneyFreeLine()).toContain('first connected client')
    expect(freeAttorneyClientCapMessage()).toContain('1 client household')
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('legacy copy when flag off', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(pricingFaqAttorneyFreeLine()).toContain('3 client households')
    expect(freeAttorneyClientCapMessage()).toContain('3 client households')
  })
})

test.describe('directory-outreach-templates', () => {
  const fields = {
    firmName: 'Perkins Coie LLP',
    firstName: 'Alex',
    claimLink: 'https://app.example.com/claim/tok_abc',
    senderName: 'Jordan',
  }

  test('attorney outreach includes claim link and first-client-free line', () => {
    const email = buildAttorneyDirectoryOutreachEmail(fields)
    expect(email.subject).toContain('Perkins Coie LLP')
    expect(email.bodyText).toContain('first connected client is free')
    expect(email.bodyText).toContain(fields.claimLink)
    expect(email.bodyHtml).toContain('Claim your listing')
  })

  test('advisor outreach emphasizes per-household not per-seat', () => {
    const email = buildAdvisorDirectoryOutreachEmail(fields)
    expect(email.bodyText).toContain('per connected household, not per seat')
    expect(email.bodyHtml).toContain(fields.claimLink)
  })
})

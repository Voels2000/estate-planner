import { test, expect } from '@playwright/test'
import {
  buildAttorneyListingSeedPayload,
  buildAdvisorDirectorySeedPayload,
  DIRECTORY_SEED_PRESERVED_LISTING_FIELDS,
  extractCredentials,
  parseCrdNumber,
  parseWsbaBarNumber,
  seedPayloadOmitsPreservedFields,
  type DirectorySeedParsedRow,
} from '@/lib/directory/directorySeedImport'

const attorneyRow: DirectorySeedParsedRow = {
  kind: 'attorney',
  contact_name: 'James A. Flaggert',
  firm_name: 'Davis Wright Tremaine LLP',
  city: 'Seattle',
  state: 'WA',
  email: 'jimflaggert@dwt.com',
  website: 'https://dwt.com',
  phone: '(206) 757-8044',
  bio: 'Chair, Trusts & Estates; WSBA #20965; confirmed EP practice lead.',
  credentials: ['JD'],
  specializations: ['trusts'],
  bar_number: '20965',
  crd_number: null,
  adv_link: null,
}

test.describe('directory seed parsing', () => {
  test('parseWsbaBarNumber prefers column then notes', () => {
    expect(parseWsbaBarNumber('38320', '')).toBe('38320')
    expect(parseWsbaBarNumber('', 'WSBA #20965; confirmed EP chair')).toBe('20965')
    expect(parseWsbaBarNumber('', 'no bar here')).toBeNull()
  })

  test('parseCrdNumber prefers column then notes', () => {
    expect(parseCrdNumber('1234567', '')).toBe('1234567')
    expect(parseCrdNumber('', 'Verify at FINRA CRD #7654321')).toBe('7654321')
    expect(parseCrdNumber('', '')).toBeNull()
  })

  test('extractCredentials includes ACTEC for attorney notes', () => {
    const creds = extractCredentials('ACTEC Fellow; JD; estate planning')
    expect(creds).toContain('ACTEC')
    expect(creds).toContain('JD')
  })
})

test.describe('directory seed commit payloads', () => {
  test('attorney payload includes credentials and bar_number', () => {
    const payload = buildAttorneyListingSeedPayload(attorneyRow, { claimToken: 'tok_abc' })
    expect(payload.bar_number).toBe('20965')
    expect(payload.credentials).toEqual(['JD'])
    expect(payload.source).toBe('outreach_seed')
  })

  test('seed upsert payloads never include outreach or claim preservation fields', () => {
    const attorneyPayload = buildAttorneyListingSeedPayload(attorneyRow, { claimToken: 'tok_abc' })
    const advisorPayload = buildAdvisorDirectorySeedPayload(
      { ...attorneyRow, kind: 'advisor', crd_number: '1234567', adv_link: 'https://example.com' },
      { claimToken: 'tok_adv' },
    )

    expect(seedPayloadOmitsPreservedFields(attorneyPayload)).toBe(true)
    expect(seedPayloadOmitsPreservedFields(advisorPayload)).toBe(true)

    for (const key of DIRECTORY_SEED_PRESERVED_LISTING_FIELDS) {
      expect(attorneyPayload).not.toHaveProperty(key)
      expect(advisorPayload).not.toHaveProperty(key)
    }
  })
})

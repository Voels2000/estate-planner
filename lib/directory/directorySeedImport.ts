/**
 * Directory seed spreadsheet parsing + DB payload builders.
 * Used by scripts/import-directory-seed.ts and unit tests.
 */

export type DirectorySeedParsedRow = {
  kind: 'attorney' | 'advisor'
  contact_name: string
  firm_name: string
  city: string | null
  state: string
  email: string
  website: string | null
  phone: string | null
  bio: string | null
  credentials: string[]
  specializations: string[]
  bar_number: string | null
  crd_number: string | null
  adv_link: string | null
}

/** DB columns never written by seed upsert — preserved on re-import (see .is('claimed_at', null) gate). */
export const DIRECTORY_SEED_PRESERVED_LISTING_FIELDS = [
  'outreach_sent_at',
  'outreach_send_count',
  'outreach_reminder_sent_at',
  'claimed_at',
  'credential_verified_at',
  'referral_code',
] as const

export function parseEmailWebsite(raw: string): { email: string; website: string | null } {
  const parts = raw
    .split(/\s*\/\s*|\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean)

  let email: string | null = null
  let website: string | null = null

  for (const part of parts) {
    if (part.includes('@') && !part.includes(' ')) {
      email = part.toLowerCase()
      continue
    }
    if (/facebook|lawyer\.com listing/i.test(part)) continue
    const normalized = part.includes('://') ? part : `https://${part.replace(/^\/*/, '')}`
    try {
      const url = new URL(normalized)
      website = url.href
      if (!email) {
        const host = url.hostname.replace(/^www\./i, '')
        email = `contact@${host}`
      }
    } catch {
      const host = part.replace(/^www\./i, '').split('/')[0]
      if (host.includes('.')) {
        website = `https://${part.replace(/^\/*/, '')}`
        if (!email) email = `contact@${host}`
      }
    }
  }

  if (!email) email = 'listing@directory-placeholder.mywealthmaps.com'
  return { email, website }
}

export function extractCredentials(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(
    /\b(CFP®?|CFA®?|ChFC|CPA|JD|LL\.?M\.?|AEP|CIMA|CPWA|RICP|CLU|ACTEC)\b/gi,
  )) {
    const token = m[1].replace(/®/g, '').replace(/\./g, '').toUpperCase()
    found.add(token === 'LLM' ? 'LL.M.' : token)
  }
  return [...found]
}

export function extractSpecializations(text: string): string[] {
  const specs: string[] = []
  if (/estate planning|estate-planning/i.test(text)) specs.push('estate-planning')
  if (/probate/i.test(text)) specs.push('probate')
  if (/trust/i.test(text)) specs.push('trusts')
  if (/tax/i.test(text)) specs.push('tax')
  return specs
}

/** WSBA column value first, then `WSBA #20965` style prose in Credential / Notes. */
export function parseWsbaBarNumber(wsbaColumn: string, notes: string): string | null {
  const fromColumn = wsbaColumn.replace(/\D/g, '')
  if (fromColumn.length >= 4 && fromColumn.length <= 6) return fromColumn

  const fromNotes = notes.match(/\bWSBA\s*#?\s*(\d{4,6})\b/i)
  return fromNotes?.[1] ?? null
}

/** CRD # column first, then `CRD 1234567` style prose in Credentials / Notes. */
export function parseCrdNumber(crdColumn: string, notes: string): string | null {
  const fromColumn = crdColumn.replace(/\D/g, '')
  if (fromColumn.length >= 5 && fromColumn.length <= 8) return fromColumn

  const fromNotes = notes.match(/\bCRD\s*#?\s*(\d{5,8})\b/i)
  return fromNotes?.[1] ?? null
}

export function buildAttorneyListingSeedPayload(
  row: DirectorySeedParsedRow,
  opts: { claimToken: string; existingProfileId?: string | null; setTokenCreatedAt?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contact_name: row.contact_name,
    firm_name: row.firm_name,
    city: row.city,
    state: row.state,
    email: row.email,
    website: row.website,
    phone: row.phone,
    bio: row.bio,
    credentials: row.credentials,
    specializations: row.specializations,
    bar_number: row.bar_number,
    is_active: true,
    is_verified: true,
    profile_id: opts.existingProfileId ?? null,
    submitted_by: null,
    source: 'outreach_seed',
    claim_token: opts.claimToken,
  }
  if (opts.setTokenCreatedAt) {
    payload.claim_token_created_at = new Date().toISOString()
  }
  return payload
}

export function buildAdvisorDirectorySeedPayload(
  row: DirectorySeedParsedRow,
  opts: { claimToken: string; existingProfileId?: string | null; setTokenCreatedAt?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contact_name: row.contact_name,
    firm_name: row.firm_name,
    city: row.city,
    state: row.state,
    email: row.email,
    website: row.website,
    bio: row.bio,
    credentials: row.credentials,
    specializations: row.specializations,
    crd_number: row.crd_number,
    adv_link: row.adv_link,
    is_active: true,
    is_verified: true,
    profile_id: opts.existingProfileId ?? null,
    source: 'outreach_seed',
    claim_token: opts.claimToken,
  }
  if (opts.setTokenCreatedAt) {
    payload.claim_token_created_at = new Date().toISOString()
  }
  return payload
}

export function seedPayloadOmitsPreservedFields(payload: Record<string, unknown>): boolean {
  return DIRECTORY_SEED_PRESERVED_LISTING_FIELDS.every((key) => !(key in payload))
}

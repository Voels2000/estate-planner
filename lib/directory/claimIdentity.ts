const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
])

export type ClaimIdentityResult =
  | { ok: true; method: 'exact' | 'domain' }
  | { ok: false; reason: string; needsReview?: boolean }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  return email.slice(at + 1).toLowerCase()
}

function hostnameFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.includes('://') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    const bare = website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
    return bare ? bare.toLowerCase() : null
  }
}

function domainsAlign(userDomain: string, listingDomain: string): boolean {
  if (userDomain === listingDomain) return true
  return userDomain.endsWith(`.${listingDomain}`) || listingDomain.endsWith(`.${userDomain}`)
}

/** Match claimer email to seeded listing email / website domain. */
export function verifyClaimIdentity(
  userEmail: string,
  listingEmail: string | null | undefined,
  website: string | null | undefined,
): ClaimIdentityResult {
  const user = normalizeEmail(userEmail)
  const userDomain = emailDomain(user)
  if (!userDomain) {
    return { ok: false, reason: 'Invalid account email.' }
  }

  const seededEmail = listingEmail?.trim() ? normalizeEmail(listingEmail) : null
  if (seededEmail && user === seededEmail) {
    return { ok: true, method: 'exact' }
  }

  if (FREE_MAIL_DOMAINS.has(userDomain)) {
    return {
      ok: false,
      reason:
        'Use a firm email address matching this listing, or contact support@mywealthmaps.com if you need help claiming.',
      needsReview: true,
    }
  }

  const listingMailDomain = seededEmail ? emailDomain(seededEmail) : null
  const webDomain = hostnameFromWebsite(website)

  if (listingMailDomain && domainsAlign(userDomain, listingMailDomain)) {
    return { ok: true, method: 'domain' }
  }
  if (webDomain && domainsAlign(userDomain, webDomain)) {
    return { ok: true, method: 'domain' }
  }

  return {
    ok: false,
    reason:
      'Your email domain does not match this listing. Contact support@mywealthmaps.com to claim manually.',
    needsReview: true,
  }
}

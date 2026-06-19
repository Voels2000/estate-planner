export const US_ONLY_SUPPORT_EMAIL = 'support@mywealthmaps.com'

/** Vercel Edge / Node — null on local dev and some networks (allowed pre-launch). */
export function getRequestCountry(request: Request): string | null {
  return request.headers.get('x-vercel-ip-country')
}

/** True when country resolved and is not US. Null/unknown → not blocked. */
export function isBlockedNonUsCountry(country: string | null): boolean {
  return Boolean(country && country !== 'US')
}

export function isGeoExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/not-available' ||
    pathname === '/favicon.ico'
  )
}

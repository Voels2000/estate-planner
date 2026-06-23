/** Canonical public app URL for emails, links, and redirects. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://mywealthmaps.com'
  )
}

function assertAbsoluteHttpUrl(url: string, label: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Invalid ${label} (expected absolute http(s) URL): ${url}`)
  }
  return url
}

/**
 * Request origin for Stripe checkout success/cancel URLs.
 * Prefer browser Origin; then Host; then env so Stripe never gets a bad absolute URL.
 */
export function getOrigin(request: Request): string {
  const origin = request.headers.get('origin')
  if (origin) return assertAbsoluteHttpUrl(origin, 'checkout origin')

  const host = request.headers.get('host')
  if (host) {
    const proto = host.startsWith('localhost') ? 'http' : 'https'
    return assertAbsoluteHttpUrl(`${proto}://${host}`, 'checkout origin')
  }

  const fallback =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-staging.vercel.app'
  return assertAbsoluteHttpUrl(fallback, 'checkout origin fallback')
}

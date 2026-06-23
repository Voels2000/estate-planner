/** Canonical public app URL for emails, links, and redirects. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://mywealthmaps.com'
  )
}

/**
 * Request origin for Stripe checkout success/cancel URLs.
 * Prefer browser Origin; then Host; then env so Stripe never gets a bad absolute URL.
 */
export function getOrigin(request: Request): string {
  const origin = request.headers.get('origin')
  if (origin) return origin

  const host = request.headers.get('host')
  if (host) {
    const proto = host.startsWith('localhost') ? 'http' : 'https'
    return `${proto}://${host}`
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-staging.vercel.app'
}

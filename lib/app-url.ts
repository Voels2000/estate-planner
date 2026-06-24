/** Trim and validate an absolute http(s) origin (no path). Fails loud on whitespace or malformed URLs. */
export function normalizeAbsoluteOrigin(url: string, label: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error(`Invalid ${label}: empty URL`)
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(`Invalid ${label} (malformed URL): ${JSON.stringify(url)}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid ${label} (expected http(s) protocol): ${JSON.stringify(url)}`)
  }

  if (/\s/.test(parsed.host)) {
    throw new Error(`Invalid ${label} (whitespace in host): ${JSON.stringify(url)}`)
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(
      `Invalid ${label} (expected origin only, no path/query/hash): ${JSON.stringify(url)}`,
    )
  }

  return `${parsed.protocol}//${parsed.host}`
}

/** Canonical public app URL for emails, links, and redirects. */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://mywealthmaps.com'
  return normalizeAbsoluteOrigin(raw, 'app URL')
}

/**
 * Request origin for Stripe checkout success/cancel URLs.
 * Prefer browser Origin; then Host; then env so Stripe never gets a bad absolute URL.
 */
export function getOrigin(request: Request): string {
  const origin = request.headers.get('origin')?.trim()
  if (origin) return normalizeAbsoluteOrigin(origin, 'checkout origin')

  const host = request.headers.get('host')?.trim()
  if (host) {
    const proto = host.startsWith('localhost') ? 'http' : 'https'
    return normalizeAbsoluteOrigin(`${proto}://${host}`, 'checkout origin')
  }

  const fallback =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ?? 'https://estate-planner-staging.vercel.app'
  return normalizeAbsoluteOrigin(fallback, 'checkout origin fallback')
}

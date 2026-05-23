/** Canonical public app URL for emails, links, and redirects. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://mywealthmaps.com'
  )
}

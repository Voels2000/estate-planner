/** Escape user-controlled strings before HTML email interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Allow only same-origin signup/login URLs in email CTAs. */
export function assertAppUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin
    if (parsed.origin !== appOrigin) return null
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

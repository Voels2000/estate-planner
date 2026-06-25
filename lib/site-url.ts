import { normalizeAbsoluteOrigin } from '@/lib/app-url'

/**
 * Canonical public site URL for auth confirmation links (per Vercel project).
 * Prefer NEXT_PUBLIC_SITE_URL; fall back to NEXT_PUBLIC_APP_URL.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL must be set for this environment.',
    )
  }
  return normalizeAbsoluteOrigin(raw, 'site URL')
}

export function buildSignupConfirmUrl(tokenHash: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'signup',
  })
  return `${getSiteUrl()}/auth/confirm?${params.toString()}`
}

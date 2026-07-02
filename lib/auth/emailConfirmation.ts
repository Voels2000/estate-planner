import type { User } from '@supabase/supabase-js'

export function isEmailConfirmed(
  user: Pick<User, 'email_confirmed_at'> | null | undefined,
): boolean {
  return Boolean(user?.email_confirmed_at)
}

/** Paths reachable while email is unverified (keep in sync with middleware). */
export const EMAIL_CONFIRM_EXEMPT_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/auth/',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/waitlist',
  '/mfa-enroll',
  '/mfa-challenge',
  '/security-step-up',
  '/settings/security',
] as const

export function isEmailConfirmExemptPath(pathname: string): boolean {
  return EMAIL_CONFIRM_EXEMPT_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix)
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

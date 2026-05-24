/** True when public signup is disabled and visitors are sent to /waitlist instead. */
export function isWaitlistMode(): boolean {
  // Go-live: set PUBLIC_SIGNUP_OPEN=true in Vercel Production (or explicit waitlist=false)
  if (
    process.env.PUBLIC_SIGNUP_OPEN === 'true' ||
    process.env.WAITLIST_MODE === 'false' ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === 'false'
  ) {
    return false
  }

  if (
    process.env.WAITLIST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'
  ) {
    return true
  }

  // Pre-launch default: gate signup on Vercel Production without requiring env vars
  return process.env.VERCEL_ENV === 'production'
}

/** Invite / token signup flows bypass the waitlist gate. */
export function shouldBypassWaitlistForSignup(
  searchParams: Pick<URLSearchParams, 'get'>
): boolean {
  if (searchParams.get('invite')) return true
  if (searchParams.get('invite_token') && searchParams.get('firm_id')) return true
  if (searchParams.get('connectionToken')) return true
  return false
}

type SignupHrefOptions = {
  redirectTo?: string
  intent?: string
  restored?: string
}

/** Public signup URL — `/waitlist` in waitlist mode, otherwise `/signup` with optional query params. */
export function getSignupHref(options?: SignupHrefOptions): string {
  if (isWaitlistMode()) return '/waitlist'

  if (!options) return '/signup'

  const params = new URLSearchParams()
  if (options.redirectTo) params.set('redirectTo', options.redirectTo)
  if (options.intent) params.set('intent', options.intent)
  if (options.restored) params.set('restored', options.restored)

  const qs = params.toString()
  return qs ? `/signup?${qs}` : '/signup'
}

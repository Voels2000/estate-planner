/** Hostnames used only for local dev — never production/preview domains. */
export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.split(':')[0].toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return true
  // `next dev` network URL (e.g. http://192.168.1.141:3000)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

function isLocalDevFromAppUrl(): boolean {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').toLowerCase()
  if (!appUrl) return false
  return (
    appUrl.includes('localhost') ||
    appUrl.includes('127.0.0.1') ||
    /192\.168\.\d{1,3}\.\d{1,3}/.test(appUrl)
  )
}

function isExplicitWaitlistDisabled(): boolean {
  return (
    process.env.PUBLIC_SIGNUP_OPEN === 'true' ||
    process.env.NEXT_PUBLIC_SIGNUP_OPEN === 'true' ||
    process.env.WAITLIST_MODE === 'false' ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === 'false'
  )
}

function isExplicitWaitlistEnabled(): boolean {
  return (
    process.env.WAITLIST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'
  )
}

type WaitlistModeOptions = {
  /** Request hostname from middleware or `headers().get('host')` on the server. */
  hostname?: string | null
}

/** True when public signup is disabled and visitors are sent to /waitlist instead. */
export function isWaitlistMode(options?: WaitlistModeOptions): boolean {
  if (isExplicitWaitlistDisabled()) {
    return false
  }

  if (typeof window !== 'undefined') {
    if (isLocalDevHost(window.location.hostname)) {
      return isExplicitWaitlistEnabled()
    }
  }

  const host = options?.hostname ?? null
  if (host && isLocalDevHost(host)) {
    return isExplicitWaitlistEnabled()
  }
  if (!host && isLocalDevFromAppUrl()) {
    return isExplicitWaitlistEnabled()
  }

  if (isExplicitWaitlistEnabled()) {
    return true
  }

  // Build-time default via next.config env (mirrors VERCEL_ENV=production pre-launch gate).
  return process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'
}

/** Invite / token signup flows bypass the waitlist gate. */
export function shouldBypassWaitlistForSignup(
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  if (searchParams.get('invite')) return true
  if (searchParams.get('invite_token') && searchParams.get('firm_id')) return true
  if (searchParams.get('connectionToken')) return true
  return false
}

type SignupHrefOptions = WaitlistModeOptions & {
  redirectTo?: string
  intent?: string
  restored?: string
}

/** Public signup URL — `/waitlist` in waitlist mode, otherwise `/signup` with optional query params. */
export function getSignupHref(options?: SignupHrefOptions): string {
  if (isWaitlistMode(options)) return '/waitlist'

  if (!options) return '/signup'

  const params = new URLSearchParams()
  if (options.redirectTo) params.set('redirectTo', options.redirectTo)
  if (options.intent) params.set('intent', options.intent)
  if (options.restored) params.set('restored', options.restored)

  const qs = params.toString()
  return qs ? `/signup?${qs}` : '/signup'
}

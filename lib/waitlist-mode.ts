/** Hostnames used only for local dev — never production/preview domains. */
export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.split(':')[0].toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return true
  // `next dev` network URL (e.g. http://192.168.1.141:3000)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/** Live marketing domain — waitlist defaults on; only PUBLIC_SIGNUP_OPEN opens signup. */
export function isProductionMarketingHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false
  const host = hostname.split(':')[0].toLowerCase()
  if (host === 'mywealthmaps.com' || host === 'www.mywealthmaps.com') return true
  return host.endsWith('.mywealthmaps.com')
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

/** Go-live flip — the only intentional way to open public signup on production. */
function isSignupExplicitlyOpen(): boolean {
  if (process.env.PUBLIC_SIGNUP_OPEN === 'true') return true
  return process.env.NEXT_PUBLIC_SIGNUP_OPEN === 'true'
}

type WaitlistModeOptions = {
  /** Request hostname from middleware or `headers().get('host')` on the server. */
  hostname?: string | null
}

function resolveHostname(options?: WaitlistModeOptions): string | null {
  if (options?.hostname) return options.hostname
  if (typeof window !== 'undefined') return window.location.hostname
  return null
}

/** True when public signup is disabled and visitors are sent to /waitlist instead. */
export function isWaitlistMode(options?: WaitlistModeOptions): boolean {
  const host = resolveHostname(options)

  // Production marketing: waitlist on unless PUBLIC_SIGNUP_OPEN (ignore dev WAITLIST_MODE=false on Vercel).
  if (isProductionMarketingHost(host)) {
    return !isSignupExplicitlyOpen()
  }

  if (isExplicitWaitlistDisabled()) {
    return false
  }

  if (typeof window !== 'undefined') {
    if (isLocalDevHost(window.location.hostname)) {
      return isExplicitWaitlistEnabled()
    }
  }

  if (host && isLocalDevHost(host)) {
    return isExplicitWaitlistEnabled()
  }
  if (
    !host &&
    isLocalDevFromAppUrl() &&
    process.env.VERCEL_ENV !== 'production'
  ) {
    return isExplicitWaitlistEnabled()
  }

  if (isExplicitWaitlistEnabled()) {
    return true
  }

  const publicMode = process.env.NEXT_PUBLIC_WAITLIST_MODE
  if (publicMode === 'true') return true
  if (publicMode === 'false') return false

  // Preview / other Vercel targets: server/edge can use VERCEL_ENV when env inlining is unreliable.
  if (typeof window === 'undefined') {
    return process.env.VERCEL_ENV === 'production'
  }

  return false
}

/** Query param + cookie for private beta signup while waitlist is on. */
export const BETA_SIGNUP_ACCESS_PARAM = 'access'
export const BETA_SIGNUP_ACCESS_LABEL_PARAM = 'label'
export const BETA_SIGNUP_ACCESS_COOKIE = 'mwm_beta_signup'
export const BETA_SIGNUP_ACCESS_LABEL_COOKIE = 'mwm_beta_signup_label'
export const BETA_SIGNUP_FUNNEL_VIEW_EVENT = 'beta_signup_link_viewed'
export const BETA_SIGNUP_ACCOUNT_SOURCE = 'beta_access_link'

function readBetaSignupToken(): string | null {
  const token = process.env.BETA_SIGNUP_TOKEN?.trim()
  return token || null
}

/** True when `access` matches server env `BETA_SIGNUP_TOKEN`. */
export function isValidBetaSignupAccessToken(token: string | null | undefined): boolean {
  const expected = readBetaSignupToken()
  if (!expected || !token) return false
  const provided = token.trim()
  if (provided.length !== expected.length) return false
  return provided === expected
}

export function hasBetaSignupAccessCookie(cookieValue: string | null | undefined): boolean {
  return cookieValue === '1'
}

export function isBetaSignupAccessActive(
  searchParams: Pick<URLSearchParams, 'get'>,
  betaAccessCookie?: string | null,
): boolean {
  if (isValidBetaSignupAccessToken(searchParams.get(BETA_SIGNUP_ACCESS_PARAM))) return true
  return hasBetaSignupAccessCookie(betaAccessCookie)
}

export function getBetaSignupAccessLabel(
  searchParams: Pick<URLSearchParams, 'get'>,
): string | null {
  const label = searchParams.get(BETA_SIGNUP_ACCESS_LABEL_PARAM)?.trim()
  return label || null
}

/** Invite / token signup flows bypass the waitlist gate. */
export function shouldBypassWaitlistForSignup(
  searchParams: Pick<URLSearchParams, 'get'>,
  options?: { betaAccessCookie?: string | null },
): boolean {
  if (isBetaSignupAccessActive(searchParams, options?.betaAccessCookie)) return true
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

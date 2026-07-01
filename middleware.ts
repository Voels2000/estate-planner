import { createServerClient } from '@supabase/ssr'
import { shouldRedirectAdvisorToBilling } from '@/lib/access/advisorBillingGate'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isLocalDevHost,
  isWaitlistMode,
  hasSignupPageAdmissionHint,
  BETA_SIGNUP_ACCESS_COOKIE,
  BETA_SIGNUP_ACCESS_LABEL_COOKIE,
  BETA_SIGNUP_ACCESS_PARAM,
  BETA_SIGNUP_ACCESS_LABEL_PARAM,
  isValidBetaSignupAccessToken,
} from '@/lib/waitlist-mode'
import {
  isEmailConfirmExemptPath,
  isEmailConfirmed,
} from '@/lib/auth/emailConfirmation'
import {
  isPrivilegedMfaEnforcementEnabled,
  profileRequiresPrivilegedMfa,
  userHasVerifiedTotpFactor,
} from '@/lib/security/privilegedMfaPolicy'
import {
  getRequestCountry,
  isBlockedNonUsCountry,
  isGeoExemptPath,
} from '@/lib/geo/usOnlyAccess'
import { attachGpcOptOutCookie } from '@/lib/privacy/globalPrivacyControl'

/** Crawlable SEO + static infra — never auth-gated or redirected. */
const INFRA_BYPASS_PATHS = [
  '/api/',
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
] as const

/** Sentry tunnel (tunnelRoute in next.config) — exact path + query variants; must stay public. */
function isSentryTunnelPath(pathname: string): boolean {
  return pathname === '/monitoring' || pathname.startsWith('/monitoring/')
}

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth',
  '/invite',
  '/billing',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/terms/accept',
  '/privacy',
  '/share/',
  '/beneficiary/',
  '/assess',
  '/waitlist',
  '/advisor-directory',
  '/pricing',
  '/find-advisor',
  '/find-attorney',
  '/claim/',
  '/event',
  '/mfa-enroll',
  '/mfa-challenge',
  '/settings/security',
  '/education',
  '/learn',
  '/intake',
  '/not-available',
]

function isInfraBypassPath(pathname: string): boolean {
  if (isSentryTunnelPath(pathname)) return true
  return INFRA_BYPASS_PATHS.some((p) =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p
  )
}

function isPublicPath(pathname: string): boolean {
  return (
    isInfraBypassPath(pathname) ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  )
}

const ATTORNEY_ONLY_PATHS = [
  '/attorney/',
]

function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('x-pathname', pathname)
  return res
}

function redirectPreservingCookies(
  request: NextRequest,
  path: string,
  source: NextResponse
) {
  const redirect = NextResponse.redirect(new URL(path, request.url))
  for (const c of source.cookies.getAll()) {
    redirect.cookies.set(c.name, c.value)
  }
  return attachGpcOptOutCookie(request, redirect)
}

function finish(request: NextRequest, response: NextResponse): NextResponse {
  return attachGpcOptOutCookie(request, response)
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // US-only page gate — APIs excluded by matcher; null country allowed (local dev / unknown).
  if (!isGeoExemptPath(pathname)) {
    const country = getRequestCountry(request)
    if (isBlockedNonUsCountry(country)) {
      return finish(
        request,
        NextResponse.redirect(new URL('/not-available', request.url)),
      )
    }
  }

  // Runtime waitlist gate — local dev hosts never redirect (env inlining in Edge is unreliable)
  const hostname = request.nextUrl.hostname
  const isLocalhost = isLocalDevHost(hostname)

  if (
    pathname === '/signup' &&
    !isLocalhost &&
    isWaitlistMode({ hostname }) &&
    !hasSignupPageAdmissionHint(searchParams, {
      betaAccessCookie: request.cookies.get(BETA_SIGNUP_ACCESS_COOKIE)?.value,
    })
  ) {
    return finish(
      request,
      NextResponse.redirect(new URL('/waitlist', request.url)),
    )
  }

  // Infra + public paths — no auth or role checks
  if (isPublicPath(pathname)) {
    const response = nextWithPathname(request, pathname)
    if (
      pathname === '/signup' &&
      isValidBetaSignupAccessToken(searchParams.get(BETA_SIGNUP_ACCESS_PARAM))
    ) {
      response.cookies.set(BETA_SIGNUP_ACCESS_COOKIE, '1', {
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      const label = searchParams.get(BETA_SIGNUP_ACCESS_LABEL_PARAM)?.trim()
      if (label) {
        response.cookies.set(BETA_SIGNUP_ACCESS_LABEL_COOKIE, label, {
          httpOnly: true,
          secure: request.nextUrl.protocol === 'https:',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        })
      }
    }
    return finish(request, response)
  }

  let supabaseResponse = nextWithPathname(request, pathname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = nextWithPathname(request, pathname)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check 1 — must be logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    for (const c of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(c.name, c.value)
    }
    return finish(request, redirect)
  }

  // Allow unauthenticated users on the landing page
  // to pass through without hitting profile queries
  if (!user) {
    return finish(request, supabaseResponse)
  }

  // Unconfirmed email — no usable session on protected surfaces (sign out + confirm page)
  if (!isEmailConfirmed(user) && !isEmailConfirmExemptPath(pathname)) {
    await supabase.auth.signOut()
    const confirmUrl = new URL('/auth/confirm-email', request.url)
    if (user.email) confirmUrl.searchParams.set('email', user.email)
    const redirect = NextResponse.redirect(confirmUrl)
    for (const c of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(c.name, c.value)
    }
    return finish(request, redirect)
  }

  // MFA enforcement — if user has enrolled a factor, require AAL2 on every request
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const isMfaFlowPath =
    pathname === '/mfa-challenge' ||
    pathname === '/mfa-enroll' ||
    pathname.startsWith('/auth/')
  if (
    aal?.nextLevel === 'aal2' &&
    aal?.currentLevel !== 'aal2' &&
    !isMfaFlowPath
  ) {
    const mfaUrl = new URL('/mfa-challenge', request.url)
    mfaUrl.searchParams.set('redirectTo', pathname)
    return redirectPreservingCookies(request, mfaUrl.pathname + mfaUrl.search, supabaseResponse)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, firm_role, is_superuser, is_admin, firm_id')
    .eq('id', user.id)
    .single()

  const isSuperuser = profile?.is_superuser === true || profile?.is_admin === true
  const isAdvisor = isAdvisorIdentity(profile?.role)
  const isFirmMember = profile?.firm_role === 'member'

  let firmSubscriptionStatus: string | null = null
  if (profile?.firm_id) {
    const { data: firm } = await supabase
      .from('firms')
      .select('subscription_status')
      .eq('id', profile.firm_id)
      .maybeSingle()
    firmSubscriptionStatus = firm?.subscription_status ?? null
  }

  if (
    isAdvisor &&
    shouldRedirectAdvisorToBilling({
      isSuperuser,
      isFirmMember,
      profileSubscriptionStatus: profile?.subscription_status,
      firmSubscriptionStatus,
      pathname,
    })
  ) {
    return redirectPreservingCookies(request, '/billing', supabaseResponse)
  }

  // Mandatory MFA for privileged roles — off until go-live (REQUIRE_PRIVILEGED_MFA=true)
  if (
    isPrivilegedMfaEnforcementEnabled() &&
    profile &&
    profileRequiresPrivilegedMfa(profile) &&
    !isMfaFlowPath
  ) {
    const hasTotp = await userHasVerifiedTotpFactor(supabase)
    if (!hasTotp) {
      const enrollUrl = new URL('/mfa-enroll', request.url)
      enrollUrl.searchParams.set('required', 'privileged')
      enrollUrl.searchParams.set('redirectTo', pathname)
      return redirectPreservingCookies(
        request,
        enrollUrl.pathname + enrollUrl.search,
        supabaseResponse,
      )
    }
  }

  // Admin portal — role guard (layout also checks isAdmin)
  if (pathname.startsWith('/admin') && !isSuperuser) {
    return redirectPreservingCookies(request, '/dashboard', supabaseResponse)
  }

  // Check 2 — attorney route guards only (superusers may access all portals)
  const isAttorneyPath = ATTORNEY_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const isAdvisorPath = pathname.startsWith('/advisor')
  const isAdvisorToolPath = pathname.startsWith('/prospect')

  if (!isSuperuser && (isAttorneyPath || isAdvisorPath || isAdvisorToolPath)) {
    const role = profile?.role

    // Attorneys can only access attorney routes
    if (role === 'attorney' && (isAdvisorPath || isAdvisorToolPath)) {
      return redirectPreservingCookies(request, '/attorney', supabaseResponse)
    }

    // Non-attorneys cannot access attorney routes
    if (role !== 'attorney' && isAttorneyPath) {
      return redirectPreservingCookies(request, '/dashboard', supabaseResponse)
    }
  }

  return finish(request, supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * Skip middleware for API routes, static assets, crawlable infra, and Sentry tunnel.
     * API routes must not enter Edge middleware — auth is enforced per route handler.
     */
    '/((?!_next/|api/|monitoring|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

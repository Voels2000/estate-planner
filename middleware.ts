import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isWaitlistMode, shouldBypassWaitlistForSignup } from '@/lib/waitlist-mode'

/** Crawlable SEO + static infra — never auth-gated or redirected. */
const INFRA_BYPASS_PATHS = [
  '/api/',
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
] as const

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
  '/event',
  '/mfa-enroll',
  '/mfa-challenge',
  '/education',
]

function isInfraBypassPath(pathname: string): boolean {
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

function redirectPreservingCookies(
  request: NextRequest,
  path: string,
  source: NextResponse
) {
  const redirect = NextResponse.redirect(new URL(path, request.url))
  for (const c of source.cookies.getAll()) {
    redirect.cookies.set(c.name, c.value)
  }
  return redirect
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Runtime waitlist gate — works even when /signup was statically prerendered without it
  if (
    pathname === '/signup' &&
    isWaitlistMode() &&
    !shouldBypassWaitlistForSignup(searchParams)
  ) {
    return NextResponse.redirect(new URL('/waitlist', request.url))
  }

  // Infra + public paths — no auth or role checks
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const nextWithPathname = () => {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('x-pathname', pathname)
    return res
  }

  let supabaseResponse = nextWithPathname()

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
          supabaseResponse = nextWithPathname()
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
    return redirect
  }

  // Allow unauthenticated users on the landing page
  // to pass through without hitting profile queries
  if (!user) {
    return supabaseResponse
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
    .select('role, subscription_status, firm_role')
    .eq('id', user.id)
    .single()

  const subscription_status = profile?.subscription_status ?? null
  const hasActiveSubscription = ['active', 'trialing', 'canceling'].includes(
    subscription_status
  )
  const isAdvisor = profile?.role === 'advisor'
  const isFirmMember = profile?.firm_role === 'member'
  if (isAdvisor && !isFirmMember && !hasActiveSubscription) {
    return redirectPreservingCookies(request, '/billing', supabaseResponse)
  }

  // Check 2 — attorney route guards only
  const isAttorneyPath = ATTORNEY_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const isAdvisorPath = pathname.startsWith('/advisor')
  const isAdvisorToolPath = pathname.startsWith('/prospect')

  if (isAttorneyPath || isAdvisorPath || isAdvisorToolPath) {
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

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Skip middleware for static assets and crawlable infra (also listed in
     * INFRA_BYPASS_PATHS as a runtime fallback if the matcher changes).
     */
    '/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth',
  '/invite',
  '/billing',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/terms',
  '/api/terms',
  '/api/stripe/webhook',
  '/api/resend/inbound',
  '/api/cron',
]

const ATTORNEY_ONLY_PATHS = [
  '/attorney',
]

const ATTORNEY_BLOCKED_PATHS = [
  '/dashboard',
  '/profile',
  '/billing',
  '/advisor',
]

const MFA_EXEMPT_PATHS = [
  '/settings/security',
  '/auth/mfa-challenge',
  '/auth/mfa-enroll',
  '/api/auth',
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectPreservingCookies(request, '/login', supabaseResponse)
  }

  // FIX: block unconfirmed users from accessing the app.
  // Supabase sets email_confirmed_at once the user clicks the confirmation link.
  // Until then, redirect to the holding page regardless of auth state.
  if (!user.email_confirmed_at) {
    return redirectPreservingCookies(request, '/confirm-email', supabaseResponse)
  }

  // Block users who haven't accepted current T&C
  const { data: termsProfile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .single()

  if (!termsProfile?.terms_accepted_at) {
    return redirectPreservingCookies(request, '/terms', supabaseResponse)
  }

  // Role-based route guards
  // Only fetch role when the path actually needs it — avoids adding a DB call
  // to every single request which can cause middleware timeouts.
  const isAttorneyPath = ATTORNEY_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const isAttorneyBlockedPath = ATTORNEY_BLOCKED_PATHS.some((p) => pathname.startsWith(p))

  if (isAttorneyPath || isAttorneyBlockedPath) {
    const { data: routeProfile } = await supabase
      .from('profiles')
      .select('role, is_attorney')
      .eq('id', user.id)
      .single()

    const userRole = routeProfile?.role
    const isAttorneyFlag = routeProfile?.is_attorney === true
    console.log('middleware role check:', { pathname, userRole, isAttorneyPath, isAttorneyBlockedPath })

    // Attorneys can only access attorney routes — block dashboard/advisor/billing
    if (userRole === 'attorney' && isAttorneyBlockedPath) {
      return redirectPreservingCookies(request, '/attorney', supabaseResponse)
    }

    // Non-attorneys cannot access attorney routes
    // Check both role and is_attorney flag to match page-level logic
    if (userRole !== 'attorney' && !isAttorneyFlag && isAttorneyPath) {
      return redirectPreservingCookies(request, '/dashboard', supabaseResponse)
    }
  }

  if (MFA_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (aal) {
    const { currentLevel, nextLevel } = aal

    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      return redirectPreservingCookies(
        request,
        '/auth/mfa-challenge',
        supabaseResponse
      )
    }

    if (nextLevel === 'aal1' && currentLevel === 'aal1') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasEnrolled = factors?.totp && factors.totp.length > 0

      if (!hasEnrolled) {
        return redirectPreservingCookies(
          request,
          '/settings/security',
          supabaseResponse
        )
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

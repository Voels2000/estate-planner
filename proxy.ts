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
  '/api/stripe/webhook',
  '/api/resend/inbound',
  '/api/cron',
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

  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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

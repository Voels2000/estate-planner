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
  '/terms',
  '/api/',
]

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let public paths through with no checks
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

  // Check 1 — must be logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirectPreservingCookies(request, '/login', supabaseResponse)
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

  if (isAttorneyPath || isAdvisorPath) {
    const role = profile?.role

    // Attorneys can only access attorney routes
    if (role === 'attorney' && isAdvisorPath) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

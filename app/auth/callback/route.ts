import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Path A: PKCE code exchange (standard OAuth/magic link flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
    }
  }
  // Path B: token_hash / OTP flow (some Supabase email templates send this instead)
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never })
    if (error) {
      return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
    }
  }
  // Neither — nothing to exchange
  else {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
  }

  // Session is now established. Fetch the user to determine correct redirect.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Fetch profile and household to determine correct redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status')
    .eq('id', user.id)
    .single()

  // New advisors with no subscription yet — route to billing
  if (
    profile?.role === 'advisor' &&
    (!profile.subscription_status || profile.subscription_status === 'incomplete')
  ) {
    return NextResponse.redirect(`${origin}/billing`)
  }

  // New consumers — no household row means profile setup is incomplete
  // Route to /profile so they complete their household before hitting dashboard
  if (profile?.role === 'consumer') {
    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!household) {
      return NextResponse.redirect(`${origin}/profile`)
    }
  }

  // Returning users — honor next param, fall back to /dashboard
  return NextResponse.redirect(`${origin}${next}`)
}

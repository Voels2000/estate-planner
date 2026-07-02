import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPostAuthConfirmSideEffects } from '@/lib/auth/runPostAuthConfirmSideEffects'

export async function GET(request: NextRequest) {
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

  let sessionError: Error | null = null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) sessionError = error
  } else if (tokenHash && type === 'magiclink') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (error) sessionError = error
  }

  if (!sessionError) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await runPostAuthConfirmSideEffects(user)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const loginParams = new URLSearchParams({
    error: 'auth_callback_failed',
    redirectTo: next,
  })
  return NextResponse.redirect(`${origin}/login?${loginParams.toString()}`)
}

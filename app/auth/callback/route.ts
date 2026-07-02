import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPostAuthConfirmSideEffects } from '@/lib/auth/runPostAuthConfirmSideEffects'
import { syncOutreachProfessionalRole } from '@/lib/auth/syncOutreachProfessionalRole'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const buildLoginRedirect = (reason: string) => {
    const loginParams = new URLSearchParams({
      error: 'auth_callback_failed',
      reason,
      redirectTo: next,
    })
    return NextResponse.redirect(new URL(`/login?${loginParams.toString()}`, origin))
  }

  if (!code) {
    return buildLoginRedirect('missing_code')
  }

  const response = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return buildLoginRedirect(error.message)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return buildLoginRedirect('no_user')

  await syncOutreachProfessionalRole(user)
  await runPostAuthConfirmSideEffects(user)
  return response
}

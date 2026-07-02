import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAdvisorPostLoginPath } from '@/lib/access/advisorBillingGate'
import { runPostAuthConfirmSideEffects } from '@/lib/auth/runPostAuthConfirmSideEffects'
import { syncOutreachProfessionalRole } from '@/lib/auth/syncOutreachProfessionalRole'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const claimRedirect = next.startsWith('/claim/') ? next : null

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

  let destination = next

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, firm_role, firm_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'attorney') {
    destination = claimRedirect ?? '/attorney'
  } else if (profile?.role === 'advisor') {
    let firmSubscriptionStatus: string | null = null
    if (profile.firm_id) {
      const { data: firm } = await supabase
        .from('firms')
        .select('subscription_status')
        .eq('id', profile.firm_id)
        .maybeSingle()
      firmSubscriptionStatus = firm?.subscription_status ?? null
    }

    destination = resolveAdvisorPostLoginPath({
      redirectTo: next,
      claimRedirect,
      firmRole: profile.firm_role,
      profileSubscriptionStatus: profile.subscription_status,
      firmSubscriptionStatus,
    })
  }

  response.headers.set('Location', new URL(destination, origin).href)
  return response
}

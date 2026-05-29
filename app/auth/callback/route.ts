import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordTermsAcceptance } from '@/lib/terms/recordTermsAcceptance'
import { ensureAdvisorActivationDripStep1 } from '@/lib/advisor/sendAdvisorDripStep'
import { sendWelcomeEmail } from '@/lib/email/welcomeEmail'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const termsAcceptedAt = user.user_metadata?.terms_accepted_at
        if (typeof termsAcceptedAt === 'string' && termsAcceptedAt) {
          const admin = createAdminClient()
          const { data: profile } = await admin
            .from('profiles')
            .select('terms_accepted_at')
            .eq('id', user.id)
            .maybeSingle()

          if (!profile?.terms_accepted_at) {
            const result = await recordTermsAcceptance(user.id, termsAcceptedAt)
            if (!result.ok) {
              console.error('terms sync from signup metadata:', result.error)
            }
          }
        }

        if (user.email) {
          const adminForEmail = createAdminClient()
          const { data: roleProfile } = await adminForEmail
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .maybeSingle()

          const isAdvisor =
            roleProfile?.role === 'advisor' || roleProfile?.role === 'financial_advisor'

          if (isAdvisor) {
            void ensureAdvisorActivationDripStep1(adminForEmail, user.id).catch((err) => {
              console.error('advisor drip step 1:', err instanceof Error ? err.message : err)
            })
          } else {
            const fullName =
              typeof user.user_metadata?.full_name === 'string'
                ? user.user_metadata.full_name
                : roleProfile?.full_name ?? ''
            const firstName = fullName.split(' ')[0] || 'there'
            void sendWelcomeEmail(user.email, firstName).catch((err) => {
              console.error('Welcome email error:', err instanceof Error ? err.message : err)
            })
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

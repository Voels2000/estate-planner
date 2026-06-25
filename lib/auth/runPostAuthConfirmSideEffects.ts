import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdvisorActivationDripStep1 } from '@/lib/advisor/sendAdvisorDripStep'
import { ensureAttorneyActivationDripStep1 } from '@/lib/attorney/sendAttorneyDripStep'
import { sendWelcomeEmail } from '@/lib/email/welcomeEmail'
import { recordTermsAcceptance } from '@/lib/terms/recordTermsAcceptance'

/** Terms sync, welcome email, and role drips after email confirmation (callback + /auth/confirm). */
export async function runPostAuthConfirmSideEffects(user: User): Promise<void> {
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

  if (!user.email) return

  const adminForEmail = createAdminClient()
  const { data: roleProfile } = await adminForEmail
    .from('profiles')
    .select('role, full_name, is_attorney')
    .eq('id', user.id)
    .maybeSingle()

  const isAdvisor =
    roleProfile?.role === 'advisor' || roleProfile?.role === 'financial_advisor'
  const isAttorney = roleProfile?.role === 'attorney' || roleProfile?.is_attorney === true

  if (isAdvisor) {
    void ensureAdvisorActivationDripStep1(adminForEmail, user.id).catch((err) => {
      console.error('advisor drip step 1:', err instanceof Error ? err.message : err)
    })
  } else if (isAttorney) {
    void ensureAttorneyActivationDripStep1(adminForEmail, user.id).catch((err) => {
      console.error('attorney drip step 1:', err instanceof Error ? err.message : err)
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

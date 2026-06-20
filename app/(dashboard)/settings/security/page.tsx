import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SecurityClient from './_security-client'
import PrivacyRightsClient from './_privacy-rights-client'
import PlanVerificationClient from './_plan-verification-client'
import DeleteAccountClient from './_delete-account-client'

export default async function SecurityPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactors = factors?.totp ?? []
  const totpFactor = totpFactors[0]
  const isEnrolled = totpFactors.length > 0

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const { data: pendingDeletion } = await admin
    .from('deletion_schedule')
    .select('scheduled_for')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-[color:var(--mwm-navy)] mb-1">Security</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage two-factor authentication for your account.
      </p>
      <SecurityClient isEnrolled={isEnrolled} factorId={totpFactor?.id} />
      {household?.id ? <PlanVerificationClient householdId={household.id} /> : null}
      <PrivacyRightsClient />
      <DeleteAccountClient
        role={profile?.role ?? null}
        subscriptionStatus={profile?.subscription_status ?? null}
        subscriptionPeriodEnd={profile?.subscription_period_end ?? null}
        pendingDeletionAt={pendingDeletion?.scheduled_for ?? null}
      />
    </div>
  )
}

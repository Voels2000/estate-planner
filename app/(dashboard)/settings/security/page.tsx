import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SecurityClient from './_security-client'

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

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Security</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage two-factor authentication for your account.
      </p>
      <SecurityClient isEnrolled={isEnrolled} factorId={totpFactor?.id} />
    </div>
  )
}

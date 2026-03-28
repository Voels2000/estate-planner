import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdvisorRegisterClient } from './_advisor-register-client'

export default async function AdvisorRegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor') redirect('/advisor-directory')

  // Check if advisor already has a listing
  const { data: existing } = await supabase
    .from('advisor_directory')
    .select('id')
    .eq('submitted_by', user.id)
    .maybeSingle()

  return (
    <AdvisorRegisterClient
      userId={user.id}
      userName={profile?.full_name ?? ''}
      userEmail={profile?.email ?? user.email ?? ''}
      existingId={existing?.id ?? null}
    />
  )
}

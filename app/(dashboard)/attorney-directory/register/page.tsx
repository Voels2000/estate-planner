import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AttorneyRegisterClient } from './_attorney-register-client'

export default async function AttorneyRegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const { data: existing } = await supabase
    .from('attorney_listings')
    .select('id')
    .eq('submitted_by', user.id)
    .maybeSingle()

  return (
    <AttorneyRegisterClient
      userId={user.id}
      userName={profile?.full_name ?? ''}
      userEmail={profile?.email ?? user.email ?? ''}
      existingId={existing?.id ?? null}
    />
  )
}

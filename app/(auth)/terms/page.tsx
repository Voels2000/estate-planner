import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TermsClient from './_terms-client'

export default async function TermsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .single()

  // Already accepted — skip straight to dashboard
  if (profile?.terms_accepted_at) redirect('/dashboard')

  return <TermsClient />
}

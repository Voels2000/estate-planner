import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TermsClient } from './_terms-client'

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .single()

  const { returnTo } = await searchParams
  const safePath = returnTo?.startsWith('/') ? returnTo : '/dashboard'

  // Already accepted — skip straight to destination
  if (profile?.terms_accepted_at) redirect(safePath)

  return <TermsClient returnTo={safePath} />
}

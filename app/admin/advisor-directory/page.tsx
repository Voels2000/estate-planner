import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminAdvisorDirectoryClient } from './_admin-advisor-directory-client'

export default async function AdminAdvisorDirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: advisors } = await supabase
    .from('advisor_directory')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminAdvisorDirectoryClient advisors={advisors ?? []} />
}

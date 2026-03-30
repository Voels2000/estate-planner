import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminAdvisorDirectoryClient } from './_admin-advisor-directory-client'

export default async function AdminAdvisorDirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.is_admin !== true) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: advisors } = await admin
    .from('advisor_directory')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminAdvisorDirectoryClient advisors={advisors ?? []} />
}
